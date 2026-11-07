cask "container-ui" do
  version "0.2.0"
  sha256 "413529c42fcf3a8801c2657749b8518ca55d6f05bf8794e21f801fea16792a68"

  url "https://github.com/BitVerseNomad/container-ui/releases/download/v#{version}/Container.UI_#{version}_aarch64.dmg"
  name "Container UI"
  desc "Unified container runtime UI - manage Colima, OrbStack, Rancher Desktop, Podman Desktop, Docker Desktop"
  homepage "https://github.com/BitVerseNomad/container-ui"

  depends_on formula: "colima"
  depends_on formula: "docker"

  app "Container UI.app"

  caveats <<~EOS
    Container UI requires Colima and Docker to be installed.
    They are installed automatically as dependencies.

    On first launch, macOS may block the app because it's not notarized by Apple.
    To allow it: System Settings → Privacy & Security → "Open Anyway"

    To grant full disk access for Docker operations:
    System Settings → Privacy & Security → Full Disk Access → Add Container UI
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