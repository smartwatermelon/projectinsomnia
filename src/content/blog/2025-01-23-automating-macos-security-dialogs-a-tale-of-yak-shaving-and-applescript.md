---
title: "Automating macOS Security Dialogs: A Tale of Yak Shaving and AppleScript"
date: 2025-01-23
description: "TL;DR: Created an AppleScript to click “Allow” on recurring nginx security prompts automatically."
tags: ["blog", "tech"]
mediumUrl: "https://medium.com/@smartwatermelon/automating-macos-security-dialogs-a-tale-of-yak-shaving-and-applescript-759300d6fba9"
---

### Automating macOS Security Dialogs: A Tale of Yak Shaving and AppleScript

**TL;DR**: Created an AppleScript to click “Allow” on recurring nginx security prompts automatically. Required UI Browser (a deprecated tool) to identify UI elements. Here’s how to get it working:

1. Install UI Browser despite Homebrew deprecation
2. Create AppleScript service to handle dialogs
3. Set up LaunchAgent to run automatically

![macOS security dialog asking to allow nginx incoming network connections](https://cdn-images-1.medium.com/max/800/1*P7h9fuubFNEVL7-R6M726A.png)
*The annoying dialog in question. I don’t know why it’s tinted pink.*

### The Problem

Running nginx on macOS 12.7.6 (Monterey) on a Mac Mini (Late 2014, Macmini7,1) presents a specific UX issue. Because this hardware can’t run newer macOS versions, and Homebrew must build nginx from source instead of using pre-built bottles, every nginx restart triggers a macOS firewall permission dialog.

In a server context, we must remember to remote desktop into the server and click the Allow button. If we can’t access the server’s desktop for whatever reason, our nginx simply won’t accept connections.

> **Technical Context**: Homebrew often builds packages from source on older macOS versions when pre-built bottles aren’t available for that OS version. This can trigger different behavior than bottle-installed versions of the same software.

### The Solution Journey

### Step 1: The UI Browser Challenge

The first obstacle was identifying the correct UI elements to manipulate. AppleScript needs precise element references, but macOS’s built-in Accessibility Inspector proved insufficient. This led to our first yak-shaving exercise:

```
# Attempt to install UI Browser  
brew install ui-browser --cask  
# Disabled because it is discontinued upstream! It was disabled on 2024-12-16.
```

The solution required editing Homebrew’s cask formula:

```
# Tap the Caskroom to get formula definition  
brew tap --force homebrew/cask  
# Edit the formula  
brew edit ui-browser --cask  

# Comment out the disable line  
# disable! date: "2024-12-16", because: :discontinued  

# Install UI Browser  
brew install ui-browser --cask
```

### Step 2: Building the Automation

With UI Browser installed, we could identify the correct element path:

tell application "System Events"  

```
    tell process "UserNotificationCenter"  
        if exists window 1 then  
            set dialogText to value of static text 1 of window 1  
            if dialogText contains "nginx" and dialogText contains "accept incoming network connections" then  
                click UI element "Allow" of window 1  
                # Optional notification; brew install terminal-notifier  
                do shell script "/usr/local/bin/terminal-notifier -message 'Allowed nginx connections' -title 'Nginx Allow Script'"  
            end if  
        end if  
    end tell  
end tell
```

Save this as `$HOME/bin/allow-nginx.scpt`

### Step 3: System Integration

Created a LaunchAgent to run the script periodically:

<?xml version="1.0" encoding="UTF-8"?>  

```
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN">  
<plist version="1.0">  
<dict>  
    <key>Label</key>  
    <string>com.local.allow-nginx</string>  
    <key>ProgramArguments</key>  
    <array>  
        <string>/Users/YOUR_USERNAME/bin/allow-nginx.scpt</string>  
    </array>  
    <key>StartInterval</key>  
    <integer>60</integer>  
    <key>RunAtLoad</key>  
    <true/>  
</dict>  
</plist>
```

Save this as `$HOME/Library/LaunchAgents/com.local.allow-nginx.plist`

Install the service and test:

launchctl load $HOME/Library/LaunchAgents/com.local.allow-nginx.plist  
sudo nginx -s stop && sudo nginx

The network connection dialog should appear and vanish within 60 seconds.

### Hardware and Software Context

This issue specifically manifests on:

- Hardware: Mac Mini Late 2014 (Macmini7,1)
- OS: macOS 12.7.6 (Monterey) — the last supported version for this Mac model
- nginx: Built from source via Homebrew

*Note: Users running newer macOS versions with bottle-installed nginx may not encounter this issue. This solution addresses a specific intersection of older hardware, OS limitations, and Homebrew’s build behavior.*

### Lessons Learned

1. **Deprecated Tools Still Matter**: Sometimes, the best tool for the job is discontinued. Don’t be afraid to work around deprecation warnings when necessary.
2. **Security vs. Convenience**: While macOS’s security model is robust, development workflows often require automation of security dialogs.
3. **AppleScript Lives On**: Despite its age, AppleScript remains vital for macOS automation, especially for UI interactions.

### Broader Implications

This solution highlights a common tension in software development: balancing security with developer experience. While macOS’s security model protects users, it can impede development workflows. Automation bridges this gap without compromising the underlying security model.

*Note: You should use this workaround cautiously and only in development environments where you understand the security implications.*

### References and Resources

An incomplete list of articles and posts I used while working on this.

- [Can you install disabled Homebrew packages?](https://stackoverflow.com/questions/73586208/can-you-install-disabled-homebrew-packages)
- [If a dialog exists, click certain button with Applescript](https://stackoverflow.com/questions/64651654/if-a-dialog-exists-click-certain-button-with-applescript)
- [UI Browser](https://latenightsw.com/freeware/ui-browser/) (deprecated)
