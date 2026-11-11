cask "wharf" do
  version "0.1.0"
  sha256 "REPLACE_WITH_SHA256"

  url "https://github.com/filipesousaduty/container-ui/releases/download/v#{version}/wharf_#{version}_aarch64.dmg"
  name "Wharf"
  desc "Unified container runtime UI - manage Colima, OrbStack, Rancher Desktop, Podman Desktop, Docker Desktop"
  homepage "https://github.com/filipesousaduty/container-ui"

  depends_on formula: "colima"
  depends_on formula: "docker"

  app "Wharf.app"

  caveats <<~EOS
    Wharf requires Colima and Docker to be installed.
    They are installed automatically as dependencies.

    On first launch, macOS may block the app because it's not notarized by Apple.
    To allow it: System Settings → Privacy & Security → "Open Anyway"

    To grant full disk access for Docker operations:
    System Settings → Privacy & Security → Full Disk Access → Add Wharf
  EOS

  auto_updates true

  # Uninstall removes the app and user data
  uninstall delete: [
    "~/Library/Application Support/dev.colima.wharf",
    "~/Library/Preferences/dev.colima.wharf.plist",
    "~/Library/Caches/dev.colima.wharf",
  ]

  zap trash: [
    "~/Library/Application Support/dev.colima.wharf",
    "~/Library/Preferences/dev.colima.wharf.plist",
    "~/Library/Caches/dev.colima.wharf",
    "~/Library/Logs/dev.colima.wharf",
  ]
end