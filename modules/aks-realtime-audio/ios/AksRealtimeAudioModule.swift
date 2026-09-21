import AVFoundation
import ExpoModulesCore

/**
 * AksRealtimeAudio native module (iOS).
 *
 * - Microphone PCM16 capture via AVAudioEngine input tap in voiceChat mode
 *   (echo cancellation for full-duplex talk), converted to the requested
 *   sample rate and streamed to JS as base64 `onAudioFrame` events in
 *   ~100 ms chunks.
 * - Assistant PCM16 playback via an AVAudioPlayerNode on the same engine;
 *   [interruptPlayback] clears scheduled buffers for barge-in,
 *   [flushPlayback] lets scheduled audio drain naturally (discarding would
 *   clip the reply tail).
 * - Phone-call style interruptions pause the engine and resume it when the
 *   interruption ends if capture was running.
 * - All failures surface as `onAudioError` events — never thrown, never silent.
 */
public class AksRealtimeAudioModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AksRealtimeAudio")

    Constants([
      "isSupported": true
    ])

    Events("onAudioFrame", "onAudioError")

    Function("startCapture") { (sampleRate: Int) in
      self.startCapture(sampleRate: sampleRate)
    }

    Function("stopCapture") {
      self.stopCapture()
    }

    Function("startPlayback") { (sampleRate: Int) in
      self.startPlayback(sampleRate: sampleRate)
    }

    Function("enqueuePcm") { (pcmBase64: String, sampleRate: Int) in
      self.enqueuePcm(pcmBase64: pcmBase64, sampleRate: sampleRate)
    }

    Function("flushPlayback") {
      // Intentional no-op: scheduled buffers drain through the player node on
      // their own. Stopping here would clip the end of Aks's reply.
    }

    Function("stopPlayback") {
      self.stopPlayback()
    }

    Function("interruptPlayback") {
      self.interruptPlayback()
    }

    OnCreate {
      self.observeInterruptions()
    }

    OnDestroy {
      self.releaseAll()
    }
  }

  private let lock = NSLock()
  private var engine: AVAudioEngine?
  private var player = AVAudioPlayerNode()
  private var playerAttached = false
  private var converter: AVAudioConverter?
  private var pendingBytes = Data()
  private var capturing = false
  private var playing = false
  private var wasCapturingBeforeInterruption = false
  private var interruptionObserver: NSObjectProtocol?

  private func emitError(_ message: String) {
    sendEvent("onAudioError", ["message": message])
  }

  // MARK: - Engine

  private func ensureEngine() throws {
    if engine != nil {
      if engine?.isRunning == false {
        try engine?.start()
      }
      return
    }
    let created = AVAudioEngine()
    created.attach(player)
    // A nil format lets the engine convert between the player and the mixer.
    created.connect(player, to: created.mainMixerNode, format: nil)
    playerAttached = true
    created.prepare()
    try created.start()
    engine = created
  }

  private func maybeStopEngine() {
    guard capturing == false, playing == false else {
      return
    }
    engine?.stop()
  }

  // MARK: - Capture

  private func startCapture(sampleRate: Int) {
    lock.lock()
    defer { lock.unlock() }
    guard capturing == false else {
      return
    }
    guard sampleRate > 0 else {
      emitError("Microphone capture needs a valid sample rate.")
      return
    }
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker, .allowBluetooth])
      try session.setActive(true)
      try ensureEngine()
      guard let engine else {
        emitError("The microphone could not be opened.")
        return
      }
      let input = engine.inputNode
      let inputFormat = input.outputFormat(forBus: 0)
      guard inputFormat.sampleRate > 0, inputFormat.channelCount > 0 else {
        emitError("The microphone is unavailable on this device.")
        return
      }
      guard let targetFormat = AVAudioFormat(
        commonFormat: .pcmFormatInt16,
        sampleRate: Double(sampleRate),
        channels: 1,
        interleaved: true
      ) else {
        emitError("Microphone capture is not available at \(sampleRate) Hz on this device.")
        return
      }
      guard let audioConverter = AVAudioConverter(from: inputFormat, to: targetFormat) else {
        emitError("Microphone capture is not available at \(sampleRate) Hz on this device.")
        return
      }
      converter = audioConverter
      pendingBytes.removeAll(keepingCapacity: true)
      let chunkBytes = (sampleRate / 10) * 2
      input.removeTap(onBus: 0)
      input.installTap(onBus: 0, bufferSize: 1024, format: inputFormat) { [weak self] buffer, _ in
        self?.convertTapBuffer(buffer, chunkBytes: chunkBytes)
      }
      capturing = true
    } catch {
      emitError("Microphone capture failed: \(error.localizedDescription).")
    }
  }

  private func convertTapBuffer(_ buffer: AVAudioPCMBuffer, chunkBytes: Int) {
    lock.lock()
    defer { lock.unlock() }
    guard capturing, let audioConverter = converter else {
      return
    }
    let capacity = AVAudioFrameCount(max(2048, buffer.frameLength * 2))
    guard let outBuffer = AVAudioPCMBuffer(
      pcmFormat: audioConverter.outputFormat,
      frameCapacity: capacity
    ) else {
      return
    }
    var inputConsumed = false
    var conversionError: NSError?
    audioConverter.convert(to: outBuffer, error: &conversionError, withInputFrom: { _, outStatus in
      if inputConsumed {
        outStatus.pointee = .noDataNow
        return nil
      }
      inputConsumed = true
      outStatus.pointee = .haveData
      return buffer
    })
    if conversionError != nil || outBuffer.frameLength == 0 {
      return
    }
    appendConverted(outBuffer, chunkBytes: chunkBytes)
  }

  private func appendConverted(_ buffer: AVAudioPCMBuffer, chunkBytes: Int) {
    guard let channel = buffer.int16ChannelData else {
      return
    }
    let byteCount = Int(buffer.frameLength) * 2
    pendingBytes.append(UnsafeRawPointer(channel[0]).assumingMemoryBound(to: UInt8.self), count: byteCount)
    while pendingBytes.count >= chunkBytes {
      let slice = pendingBytes.prefix(chunkBytes)
      pendingBytes.removeFirst(chunkBytes)
      sendEvent("onAudioFrame", ["pcmBase64": Data(slice).base64EncodedString()])
    }
  }

  private func stopCapture() {
    lock.lock()
    defer { lock.unlock() }
    guard capturing else {
      return
    }
    capturing = false
    engine?.inputNode.removeTap(onBus: 0)
    converter = nil
    pendingBytes.removeAll(keepingCapacity: false)
    maybeStopEngine()
  }

  // MARK: - Playback

  private func startPlayback(sampleRate: Int) {
    lock.lock()
    defer { lock.unlock() }
    guard playing == false else {
      return
    }
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker, .allowBluetooth])
      try session.setActive(true)
      try ensureEngine()
      if player.isPlaying == false {
        player.play()
      }
      playing = true
    } catch {
      emitError("Audio playback failed: \(error.localizedDescription).")
    }
  }

  private func enqueuePcm(pcmBase64: String, sampleRate: Int) {
    lock.lock()
    defer { lock.unlock() }
    guard playing else {
      // Silent drop: chunks racing teardown must never surface as errors.
      return
    }
    guard let data = Data(base64Encoded: pcmBase64), data.count >= 2 else {
      emitError("Received an audio chunk that could not be decoded.")
      return
    }
    let frameCount = data.count / 2
    guard let format = AVAudioFormat(
      commonFormat: .pcmFormatInt16,
      sampleRate: Double(sampleRate),
      channels: 1,
      interleaved: true
    ),
    let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(frameCount)) else {
      emitError("Received an audio chunk that could not be played.")
      return
    }
    buffer.frameLength = AVAudioFrameCount(frameCount)
    data.withUnsafeBytes { raw in
      guard let source = raw.baseAddress, let destination = buffer.int16ChannelData else {
        return
      }
      memcpy(destination[0], source, data.count)
    }
    player.scheduleBuffer(buffer, completionHandler: nil)
  }

  private func interruptPlayback() {
    lock.lock()
    defer { lock.unlock() }
    // Barge-in: stop clears scheduled buffers so Aks stops talking at once.
    // The engine keeps running, so the next chunk plays immediately.
    player.stop()
    if playing, player.isPlaying == false {
      player.play()
    }
  }

  private func stopPlayback() {
    lock.lock()
    defer { lock.unlock() }
    guard playing else {
      return
    }
    playing = false
    player.stop()
    maybeStopEngine()
  }

  // MARK: - Interruptions & teardown

  private func observeInterruptions() {
    interruptionObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.interruptionNotification,
      object: AVAudioSession.sharedInstance(),
      queue: .main
    ) { [weak self] notification in
      self?.handleInterruption(notification)
    }
  }

  private func handleInterruption(_ notification: Notification) {
    guard let info = notification.userInfo,
      let rawType = info[AVAudioSessionInterruptionTypeKey] as? UInt,
      let type = AVAudioSession.InterruptionType(rawValue: rawType) else {
      return
    }
    lock.lock()
    defer { lock.unlock() }
    switch type {
    case .began:
      wasCapturingBeforeInterruption = capturing
      engine?.pause()
    case .ended:
      let options = (info[AVAudioSessionInterruptionOptionKey] as? UInt).map(AVAudioSession.InterruptionOptions.init(rawValue:)) ?? []
      guard options.contains(.shouldResume), wasCapturingBeforeInterruption else {
        wasCapturingBeforeInterruption = false
        return
      }
      wasCapturingBeforeInterruption = false
      do {
        try engine?.start()
      } catch {
        emitError("Microphone capture failed: \(error.localizedDescription).")
      }
    @unknown default:
      break
    }
  }

  private func releaseAll() {
    lock.lock()
    defer { lock.unlock() }
    if let observer = interruptionObserver {
      NotificationCenter.default.removeObserver(observer)
      interruptionObserver = nil
    }
    capturing = false
    playing = false
    engine?.inputNode.removeTap(onBus: 0)
    player.stop()
    engine?.stop()
    engine = nil
    converter = nil
    pendingBytes.removeAll(keepingCapacity: false)
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }
}
