package com.aks.realtimeaudio

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.os.Process
import android.util.Base64
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.roundToInt

/**
 * AksRealtimeAudio native module (Android).
 *
 * - Microphone PCM16 capture via AudioRecord with VOICE_COMMUNICATION (echo
 *   cancellation for full-duplex talk) streamed to JS as base64 `onAudioFrame`
 *   events in ~100 ms chunks.
 * - Assistant PCM16 playback via a streaming AudioTrack fed by [enqueuePcm];
 *   [interruptPlayback] clears the queue for barge-in, [flushPlayback] lets
 *   buffered audio drain naturally (discarding would clip the reply tail).
 * - All errors surface as `onAudioError` events — never thrown, never silent.
 */
class AksRealtimeAudioModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AksRealtimeAudio")

    Constants("isSupported" to true)

    Events("onAudioFrame", "onAudioError")

    Function("startCapture") { sampleRate: Int ->
      startCapture(sampleRate)
    }

    Function("stopCapture") {
      stopCapture()
    }

    Function("startPlayback") { sampleRate: Int ->
      startPlayback(sampleRate)
    }

    Function("enqueuePcm") { pcmBase64: String, sampleRate: Int ->
      enqueuePcm(pcmBase64, sampleRate)
    }

    Function("flushPlayback") {
      // Intentional no-op: queued audio drains through the track on its own.
      // Discarding here would clip the end of Aks's reply.
    }

    Function("stopPlayback") {
      stopPlayback()
    }

    Function("interruptPlayback") {
      interruptPlayback()
    }

    OnDestroy {
      releaseAll()
    }
  }

  // MARK: - Capture

  private val captureLock = Any()
  private var recorder: AudioRecord? = null
  private var captureThread: Thread? = null
  private val capturing = AtomicBoolean(false)

  private fun emitError(message: String) {
    try {
      sendEvent("onAudioError", mapOf("message" to message))
    } catch (_: Exception) {
      // The JS runtime may already be gone during teardown.
    }
  }

  private fun startCapture(sampleRate: Int) {
    synchronized(captureLock) {
      if (capturing.get()) return
      val context = appContext.reactContext
      if (context == null) {
        emitError("Audio is unavailable: the app context is gone.")
        return
      }
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
        emitError("Microphone access is needed for a voice conversation.")
        return
      }
      val minBuffer = AudioRecord.getMinBufferSize(
        sampleRate,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
      )
      if (minBuffer <= 0) {
        emitError("Microphone capture is not available at ${sampleRate} Hz on this device.")
        return
      }
      try {
        val record = AudioRecord.Builder()
          .setAudioSource(MediaRecorder.AudioSource.VOICE_COMMUNICATION)
          .setAudioFormat(
            AudioFormat.Builder()
              .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
              .setSampleRate(sampleRate)
              .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
              .build(),
          )
          .setBufferSizeInBytes(minBuffer * 2)
          .build()
        if (record.state != AudioRecord.STATE_INITIALIZED) {
          record.release()
          emitError("The microphone could not be opened.")
          return
        }
        record.startRecording()
        recorder = record
        capturing.set(true)
        captureThread = Thread({ captureLoop(record, sampleRate) }, "aks-realtime-capture").apply {
          start()
        }
      } catch (e: SecurityException) {
        emitError("Microphone access is needed for a voice conversation.")
      } catch (e: Exception) {
        emitError("Microphone capture failed: ${e.message ?: "unknown error"}.")
      }
    }
  }

  private fun captureLoop(record: AudioRecord, sampleRate: Int) {
    Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO)
    // ~100 ms of mono 16-bit audio per event.
    val framesPerChunk = sampleRate / 10
    val shorts = ShortArray(framesPerChunk)
    while (capturing.get()) {
      val read = try {
        record.read(shorts, 0, framesPerChunk)
      } catch (e: Exception) {
        emitError("Microphone capture failed: ${e.message ?: "unknown error"}.")
        break
      }
      if (read < 0) {
        emitError("Microphone capture failed (error ${read}).")
        break
      }
      if (read == 0) continue
      val bytes = ByteBuffer.allocate(read * 2).order(ByteOrder.LITTLE_ENDIAN).apply {
        asShortBuffer().put(shorts, 0, read)
      }.array()
      try {
        sendEvent("onAudioFrame", mapOf("pcmBase64" to Base64.encodeToString(bytes, Base64.NO_WRAP)))
      } catch (_: Exception) {
        break
      }
    }
  }

  private fun stopCapture() {
    synchronized(captureLock) {
      if (!capturing.getAndSet(false)) return
      // Stopping the recorder unblocks a thread parked in read().
      try {
        recorder?.stop()
      } catch (_: Exception) {
      }
      try {
        captureThread?.join(1000)
      } catch (_: Exception) {
      }
      try {
        recorder?.release()
      } catch (_: Exception) {
      }
      recorder = null
      captureThread = null
    }
  }

  // MARK: - Playback

  private val playbackLock = Any()
  private var track: AudioTrack? = null
  private var trackSampleRate = 0
  private var playbackThread: Thread? = null
  private val playing = AtomicBoolean(false)
  private val playQueue = LinkedBlockingQueue<ByteArray>(100)

  private fun startPlayback(sampleRate: Int) {
    synchronized(playbackLock) {
      if (playing.get()) return
      val minBuffer = AudioTrack.getMinBufferSize(
        sampleRate,
        AudioFormat.CHANNEL_OUT_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
      )
      if (minBuffer <= 0) {
        emitError("Audio playback is not available at ${sampleRate} Hz on this device.")
        return
      }
      try {
        val audioTrack = AudioTrack.Builder()
          .setAudioAttributes(
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
              .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
              .build(),
          )
          .setAudioFormat(
            AudioFormat.Builder()
              .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
              .setSampleRate(sampleRate)
              .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
              .build(),
          )
          .setBufferSizeInBytes(minBuffer * 2)
          .setTransferMode(AudioTrack.MODE_STREAM)
          .build()
        if (audioTrack.state != AudioTrack.STATE_INITIALIZED) {
          audioTrack.release()
          emitError("Audio playback could not be opened.")
          return
        }
        audioTrack.play()
        track = audioTrack
        trackSampleRate = sampleRate
        playing.set(true)
        playbackThread = Thread({ playbackLoop() }, "aks-realtime-playback").apply {
          start()
        }
      } catch (e: Exception) {
        emitError("Audio playback failed: ${e.message ?: "unknown error"}.")
      }
    }
  }

  private fun playbackLoop() {
    Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO)
    while (playing.get()) {
      val bytes = try {
        playQueue.take()
      } catch (_: InterruptedException) {
        break
      }
      val active = synchronized(playbackLock) { if (playing.get()) track else null } ?: break
      try {
        var offset = 0
        while (offset < bytes.size && playing.get()) {
          val written = active.write(bytes, offset, bytes.size - offset)
          if (written < 0) break
          offset += written
        }
      } catch (_: Exception) {
        break
      }
    }
  }

  /** Linear resample for mono 16-bit PCM when the chunk rate differs from the track rate. */
  private fun resampleIfNeeded(bytes: ByteArray, fromRate: Int, toRate: Int): ByteArray {
    if (fromRate == toRate || bytes.size < 2) return bytes
    val input = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer()
    val inFrames = bytes.size / 2
    val outFrames = ((inFrames.toLong() * toRate) / fromRate).toInt().coerceAtLeast(1)
    val output = ByteBuffer.allocate(outFrames * 2).order(ByteOrder.LITTLE_ENDIAN)
    var position = 0.0
    val step = inFrames.toDouble() / outFrames
    val samples = ShortArray(inFrames).also { input.get(it) }
    repeat(outFrames) {
      val index = position.toInt().coerceIn(0, inFrames - 1)
      val fraction = position - position.toInt()
      val first = samples[index].toInt()
      val second = samples[(index + 1).coerceAtMost(inFrames - 1)].toInt()
      output.putShort((first + ((second - first) * fraction)).roundToInt().coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort())
      position += step
    }
    return output.array()
  }

  private fun enqueuePcm(pcmBase64: String, sampleRate: Int) {
    val rate: Int
    synchronized(playbackLock) {
      if (!playing.get() || track == null) {
        // Silent drop: chunks racing teardown must never surface as errors.
        return
      }
      rate = trackSampleRate
    }
    val decoded = try {
      Base64.decode(pcmBase64, Base64.DEFAULT)
    } catch (_: Exception) {
      emitError("Received an audio chunk that could not be decoded.")
      return
    }
    if (decoded.isEmpty()) return
    val bytes = try {
      resampleIfNeeded(decoded, sampleRate, rate)
    } catch (_: Exception) {
      emitError("Received an audio chunk that could not be played.")
      return
    }
    // Bounded queue: if the producer outruns playback, shed the oldest audio
    // instead of growing memory without bound.
    if (!playQueue.offer(bytes)) {
      playQueue.poll()
      playQueue.offer(bytes)
    }
  }

  private fun interruptPlayback() {
    synchronized(playbackLock) {
      playQueue.clear()
      val active = track ?: return
      try {
        // Barge-in: discard unplayed audio immediately so Aks stops talking.
        active.pause()
        active.flush()
        if (playing.get()) active.play()
      } catch (_: Exception) {
      }
    }
  }

  private fun stopPlayback() {
    val thread: Thread?
    val active: AudioTrack?
    synchronized(playbackLock) {
      if (!playing.getAndSet(false)) {
        playQueue.clear()
        return
      }
      playQueue.clear()
      thread = playbackThread
      active = track
      playbackThread = null
      track = null
      trackSampleRate = 0
    }
    thread?.interrupt()
    try {
      thread?.join(1000)
    } catch (_: Exception) {
    }
    try {
      active?.stop()
    } catch (_: Exception) {
    }
    try {
      active?.release()
    } catch (_: Exception) {
    }
  }

  private fun releaseAll() {
    try {
      stopCapture()
    } catch (_: Exception) {
    }
    try {
      stopPlayback()
    } catch (_: Exception) {
    }
  }
}
