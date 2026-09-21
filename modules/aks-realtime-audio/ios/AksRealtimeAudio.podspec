Pod::Spec.new do |s|
  s.name           = 'AksRealtimeAudio'
  s.version        = '1.0.0'
  s.summary        = 'Live PCM microphone capture and streaming audio playback for Aks realtime voice.'
  s.description    = 'Expo module backing the AksRealtimeAudio JS contract: mic PCM16 capture events plus PCM playback queue.'
  s.author         = 'aks'
  s.homepage       = 'https://example.com'
  s.platforms      = { :ios => '15.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,mm,swift}"
end
