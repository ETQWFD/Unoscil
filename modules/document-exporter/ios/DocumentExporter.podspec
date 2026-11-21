require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'DocumentExporter'
  s.version        = package['version']
  s.summary        = 'Expo module exposing the iOS document export picker'
  s.description    = 'Presents UIDocumentPickerViewController(forExporting:) so the user picks where to save a file'
  s.license        = 'MIT'
  s.author         = 'unoscil'
  s.homepage       = 'https://github.com/nicepkg/unoscil'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/nicepkg/unoscil.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = ['*.swift']
end
