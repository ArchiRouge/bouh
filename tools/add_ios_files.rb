# Copies the native Swift files into the Xcode project and adds them to the "App" target.
# Usage (from the project root): ruby tools/add_ios_files.rb
# Needs the xcodeproj gem (bundled with CocoaPods, or: gem install xcodeproj --user-install)
require 'fileutils'
require 'xcodeproj'

project_path = 'ios/App/App.xcodeproj'
abort "#{project_path} not found — run `npx cap add ios` first." unless File.exist?(project_path)

project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |t| t.name == 'App' } or abort 'Target "App" not found'
group = project.main_group.find_subpath('App', false) or abort 'Group "App" not found'

%w[PedometerPlugin.swift MainViewController.swift].each do |f|
  FileUtils.cp(File.join('ios-plugin', f), File.join('ios/App/App', f))
  next if group.files.any? { |ref| ref.path == f }
  ref = group.new_reference(f)
  target.add_file_references([ref])
  puts "Added #{f} to target App"
end
project.save
puts 'Xcode project updated.'
