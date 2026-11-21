require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'UcEngine'
  s.version        = package['version']
  s.summary        = 'Expo host for the shared Unoscil P2P engine'
  s.description    = 'System adapters and lifecycle host for the shared Unoscil P2P engine'
  s.license        = 'AGPL-3.0-only'
  s.author         = 'unoscil'
  s.homepage       = 'https://github.com/ETQWFD/Unoscil'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/ETQWFD/Unoscil.git' }
  s.static_framework = true

  s.dependency 'UcEngineCore'
  s.dependency 'ExpoModulesCore'
  s.source_files = ['UcEngineModule.swift', 'NativeLifecycleHost.swift']
  s.pod_target_xcconfig = {
    'SWIFT_ACTIVE_COMPILATION_CONDITIONS' => ENV['UC_ENGINE_LOCAL_CORE'] == '1' ? '$(inherited) UC_ENGINE_LOCAL_CORE' : '$(inherited)',
  }
end
