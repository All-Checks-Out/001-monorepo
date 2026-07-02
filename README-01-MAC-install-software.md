# 01 Mac Install Software

## Required Software

- Google Chrome
- Visual Studio Code
- git
- Git Credential Manager
- Node.js
- pnpm `11.8.0`
- AWS CLI
- AWS CDK CLI
- Flyway
- pgAdmin 4
- jq
- OrbStack

---

## Install Homebrew

Go to:

```text
https://brew.sh
```

Install Homebrew using the command shown on that page.

Open a new terminal.

Check Homebrew:

```bash
brew --version
```

Homebrew is usually installed here:

```text
/opt/homebrew
```

---

## Install Software With Homebrew

```bash
brew install --cask google-chrome
brew install --cask visual-studio-code
brew install --cask git-credential-manager
brew install --cask pgadmin4
brew install --cask orbstack
brew install git
brew install node
brew install pnpm
brew install awscli
brew install aws-cdk
brew install flyway
brew install jq
```

Open OrbStack once and let it finish setting up.

---

## Configure Git

Open a new terminal.

```bash
git-credential-manager configure
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

---

## Create `.bash_profile`

From the repo root:

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

From the repo root:

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
