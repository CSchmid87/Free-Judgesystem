#!/usr/bin/env bash

# Simple macOS Git installer using Homebrew
# Usage: ./install-git.sh

set -euo pipefail

# Check for Homebrew
if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew not found. Installing..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  echo "
# Add Homebrew to your PATH if necessary (run in your shell profile):"
  if [[ $(uname -m) == "arm64" ]]; then
    echo "  eval \"$(/opt/homebrew/bin/brew shellenv)\""
  else
    echo "  eval \"$(/usr/local/bin/brew shellenv)\""
  fi
  echo
else
  echo "Homebrew is installed."
fi

# Ensure brew is updated
echo "Updating Homebrew..."
brew update

# Install Git
if ! brew list git >/dev/null 2>&1; then
  echo "Installing Git via Homebrew..."
  brew install git
else
  echo "Git already installed via Homebrew (version $(git --version))."
fi

# Optional repository setup
if [[ -n "${1:-}" ]]; then
  repo_url="$1"
  echo "
Initializing repository and adding remote $repo_url"
  if [[ ! -d .git ]]; then
    git init
  fi
  git remote remove origin 2>/dev/null || true
  git remote add origin "$repo_url"
  echo "Remote origin set to $(git remote get-url origin)"
fi

# Post-install
echo "
Verification:"
which -a git
git --version

cat <<'EOF'

Next steps:
  * configure your git identity:
      git config --global user.name "Your Name"
      git config --global user.email "you@example.com"
  * add Homebrew to your PATH if the `which -a git` output shows /usr/bin/git first

EOF
