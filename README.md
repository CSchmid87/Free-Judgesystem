# Git Installation Helper

This small workspace contains a helper script for installing Git on macOS using Homebrew.

## Usage

1. **Detect environment**
   ```sh
   sw_vers -productVersion
   uname -m
   git --version
   which -a git
   which brew && brew --version
   xcode-select -p || echo "no xcode-select path"
   ```

2. **Run the installer script**
   ```sh
   chmod +x install-git.sh
   ./install-git.sh
   ```

   The script will prompt you if it needs to install Homebrew and will install Git via Homebrew.

3. **Configure Git**
   ```sh
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   git config --global --list
   ```

4. **Upgrade / Uninstall**
   ```sh
   brew update && brew upgrade git
   brew uninstall git
   ```

5. **Connect to your GitHub repository**
   After Git is installed, you can optionally initialize the repository and add your GitHub remote in one step:
   ```sh
   # install Git and link to your repo in a single command
   chmod +x install-git.sh
   ./install-git.sh https://github.com/CSchmid87/Free-Judgesystem.git
   ```

   If you prefer to run the steps manually:
   ```sh
   git init
   git remote add origin https://github.com/CSchmid87/Free-Judgesystem.git
   git fetch origin
   git branch -M main
   git push -u origin main
   ```
   If the repository already contains commits, you may need to pull or merge instead.
   This workspace is now linked to your GitHub repository.


## Notes
- Requires administrator privileges for Homebrew installation.
- Works on macOS 10.14+ (tested on 11/12/13/14) on both Intel and Apple Silicon.
- The script does not modify shell profiles; if you need `brew` on PATH, add it manually.
