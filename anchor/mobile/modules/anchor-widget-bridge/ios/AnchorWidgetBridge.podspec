Pod::Spec.new do |s|
  s.name           = 'AnchorWidgetBridge'
  s.version        = '1.0.0'
  s.summary        = 'Shares Anchor widget snapshot data with the WidgetKit extension'
  s.description    = 'Local Expo module that writes the widget snapshot JSON into the shared App Group UserDefaults and reloads WidgetKit timelines.'
  s.author         = 'Anchor'
  s.homepage       = 'https://anchorintentions.com'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.license        = { type: 'UNLICENSED' }

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  s.source_files = '**/*.{h,m,swift}'
end
