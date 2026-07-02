# 01 Windows Install Software

## Required Software

- Google Chrome
- Visual Studio Code
- git
- Git Credential Manager
- Docker Desktop
- WSL2 Ubuntu
- Node.js
- pnpm `11.8.0`
- AWS CLI
- AWS CDK CLI
- Flyway
- pgAdmin 4
- jq

---

## Install WSL2

Open PowerShell as Administrator:

```powershell
wsl --install
```

Restart Windows if prompted.

Open Ubuntu from the Start menu.

Update Ubuntu:

```bash
sudo apt update
sudo apt upgrade -y
```

---

## Install Windows Desktop Apps

Open PowerShell:

```powershell
winget install Google.Chrome
winget install Microsoft.VisualStudioCode
winget install Git.Git
winget install GitCredentialManager.GitCredentialManager
winget install Docker.DockerDesktop
winget install PostgreSQL.pgAdmin
```

Open Docker Desktop.

Enable WSL2 integration for your Ubuntu distribution.

Run repo commands inside WSL2.

Docker Desktop with WSL2 integration provides the local container runtime on Windows.

---

## Install Homebrew In WSL2

Inside Ubuntu, go to:

```text
https://brew.sh
```

Install Homebrew using the Linux command shown on that page.

Open a new Ubuntu terminal.

Check Homebrew:

```bash
brew --version
```

Homebrew on Linux is usually installed here:

```text
/home/linuxbrew/.linuxbrew
```

Homebrew casks are macOS desktop app installs. Do not use Homebrew casks inside WSL2.

---

## Install Command-Line Tools In WSL2

```bash
brew install git
brew install node
brew install pnpm
brew install awscli
brew install aws-cdk
brew install flyway
brew install jq
```

---

## Configure Git

Open a new Ubuntu terminal.

```bash
git-credential-manager configure
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

---

## Create `.bash_profile`

Clone the repo first.

Example:

```bash
mkdir -p ~/src
cd ~/src
git clone https://github.com/All-Checks-Out/001-monorepo.git
cd 001-monorepo
```

From the repo root inside WSL2:

```bash
cp bash_profile.example ~/.bash_profile
```

If `~/.bash_profile` already exists, copy the required lines from `bash_profile.example` into the existing file instead.

Do not worry about the placeholder account IDs in this file:

```text
111111111111
222222222222
333333333333
444444444444
```

These are updated later during AWS account setup.

Reload Bash:

```bash
source ~/.bash_profile
```

Open a new Ubuntu terminal before continuing.

---

## Check Versions

```bash
git --version
node --version
pnpm --version
aws --version
cdk --version
flyway --version
jq --version
docker --version
```

`pnpm` should be:

```text
11.8.0
```

---

## Install Repo Dependencies

From the repo root inside WSL2:

```bash
pnpm install
```

Clean install:

```bash
pnpm run package-cleanup
pnpm install
```

Next:

```text
README-02-aws-account-setup.md
```
