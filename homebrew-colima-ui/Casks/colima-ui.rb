cask "colima-ui" do
  version "0.1.0"
  sha256 "REPLACE_WITH_SHA256"

  url "https://github.com/filipesousaduty/colima-ui/releases/download/v#{version}/colima-ui_#{version}_aarch64.dmg"
  name "Colima UI"
  desc "Docker Desktop alternative for Colima - manage containers, images, volumes, networks, Kubernetes"
  homepage "https://github.com/filipesousaduty/colima-ui"

  depends_on formula: "colima"
  depends_on formula: "docker"

  app "Colima UI.app"

  caveats <<~EOS
    Colima UI requires Colima and Docker to be installed.
    They are installed automatically as dependencies.

    On first launch, macOS may block the app because it's not notarized by Apple.
    To allow it: System Settings → Privacy & Security → "Open Anyway"

    To grant full disk access for Docker operations:
    System Settings → Privacy & Security → Full Disk Access → Add Colima UI
  EOS

  auto_updates true

  # Uninstall removes the app and user data
  uninstall delete: [
    "~/Library/Application Support/dev.colima.ui",
    "~/Library/Preferences/dev.colima.ui.plist",
    "~/Library/Caches/dev.colima.ui",
  ]

  zap trash: [
    "~/Library/Application Support/dev.colima.ui",
    "~/Library/Preferences/dev.colima.ui.plist",
    "~/Library/Caches/dev.colima.ui",
    "~/Library/Logs/dev.colima.ui",
  ]
end