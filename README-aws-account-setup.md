# AWS Account Setup

Use this guide when setting up a new All Checks Out AWS organization, or when a developer needs to point a local checkout at their own AWS account IDs.

The repo expects four AWS accounts:

- management
- testing
- staging
- production

## Create the AWS Organization

- create an AWS Organization
- create four accounts:
  - management
  - testing
  - staging
  - production

Record the 12-digit account ID for each account. You will need these IDs later when configuring your local checkout.

Example placeholders:

```text
management: 111111111111
testing:    222222222222
staging:    333333333333
production: 444444444444
```

Use your own real 12-digit account IDs. Do not commit real account IDs to the repo.

---

## Create a Permission Set

- Identity Center → Permission sets → Create permission set
- Predefined permission set
- AdministratorAccess
- NEXT
- Permission set name = `new-permission-set`
- NEXT
- CREATE

Note:

- it will initially show **Not provisioned**
- this is expected

---

## Create a Group

- Identity Center → Groups → Create group
- Group name = `new-group`
- CREATE GROUP

---

## Create a User

- Identity Center → Users → Add user
- email = a real email address
- first name = `New`
- last name = `User`
- generate one-time password
- NEXT
- add user to group = `new-group`
- NEXT
- ADD USER

- press COPY
- paste the clipboard into a temporary document
- extract the one-time password

- VIEW USER DETAILS
- SEND EMAIL VERIFICATION LINK
- SEND

---

## Verify the User

- open the verification email
- press VERIFY
- press LOGIN

- username = `new-user`
- password = one-time password
- choose a new password

Tip:

- let Google save the password
- change the username in Google Password Manager to `new-user`

Expected result:

- user is logged in
- **no AWS accounts are visible**

This is correct.

---

## Assign Management Account

- log back in to the AWS root account

Identity Center → AWS Accounts

- tick the management account
- ASSIGN USERS OR GROUPS
- GROUPS
- tick `new-group`
- NEXT
- tick `new-permission-set`
- NEXT
- SUBMIT

Optional checks

- View Details → 1 successful assignment
- Users → new-user → AWS Accounts
- management account shows `new-permission-set`

---

## Assign Remaining Accounts

Repeat exactly the same steps for

- testing
- staging
- production

---

## Check Assignments

Identity Center → AWS Accounts

Each account should now show

- AdministratorAccess
- new-permission-set

---

## Login as new-user

Identity Center → Dashboard

Copy the **IPv4-only** AWS Access Portal URL

Example:

```
https://d-xxxxxxxxxxxx.awsapps.com/start
```

It always ends with:

```
/start
```

Open that URL in a private/incognito window.

Login as

- username = `new-user`
- password = your chosen password

Initially you may need to press the **Refresh** button in the portal.

Expected result:

- management
- testing
- staging
- production

Expand any account.

Expected result:

```
new-permission-set
```

appears beneath the account.

---

## Configure Local Account IDs

After cloning or pulling the repo, configure your own AWS account IDs in your shell profile.

For Bash this is usually:

```text
~/.bash_profile
```

For Zsh this is usually:

```text
~/.zshrc
```

Add:

```bash
export ACO24_MANAGEMENT_ACCOUNT_ID="111111111111"
export ACO24_TESTING_ACCOUNT_ID="222222222222"
export ACO24_STAGING_ACCOUNT_ID="333333333333"
export ACO24_PRODUCTION_ACCOUNT_ID="444444444444"
```

Replace the placeholder values with your real 12-digit account IDs.

Reload your shell profile, or open a new terminal. For example:

```bash
source ~/.zshrc
```

From the repo root, after `pnpm install`, generate the local TypeScript account config:

```bash
pnpm run aws:accounts-config
```

This creates:

```text
packages/shared/aws-accounts/src/index.ts
```

That file is generated from your shell environment and is ignored by git. It is used by the CDK apps so each developer can deploy to their own AWS accounts without changing source code.

If any account ID is missing or is not exactly 12 digits, the command will fail with an error.

---

## Bootstrap AWS Accounts

Before deploying to AWS, log in to the relevant AWS SSO profiles:

```bash
aws sso login --profile management
aws sso login --profile testing
aws sso login --profile staging
aws sso login --profile production
```

Bootstrap all accounts:

```bash
pnpm run bootstrap-up -- management
pnpm run bootstrap-up -- testing
pnpm run bootstrap-up -- staging
pnpm run bootstrap-up -- production
```

Or bootstrap everything in one command:

```bash
pnpm run bootstrap-up -- all
```

The bootstrap script reads the same `ACO24_*_ACCOUNT_ID` environment variables directly and validates that each value is exactly 12 digits.

---

## Destroy Deployed Stacks

Destroy deployed application and service stacks before deleting bootstrap resources.

Testing:

```bash
aws sso login --profile management
aws sso login --profile testing
pnpm run destroy -- testing
```

Staging:

```bash
aws sso login --profile management
aws sso login --profile staging
pnpm run destroy -- staging
```

Production:

```bash
aws sso login --profile management
aws sso login --profile production
pnpm run destroy -- production
```

Production destroy asks you to type:

```text
destroy production infrastructure
```

---

## Destroy Bootstrap Resources

Only destroy bootstrap resources after deployed stacks have been destroyed.

Log in to any profiles whose bootstrap resources you are deleting if your SSO sessions have expired.

```bash
pnpm run bootstrap-down -- testing
pnpm run bootstrap-down -- staging
pnpm run bootstrap-down -- production
pnpm run bootstrap-down -- management
```

This deletes the CDK bootstrap stack in `eu-west-2` and `us-east-1` for each selected account, then runs cleanup for bootstrap buckets and container repositories.

After this, any AWS account or organization deletion is done manually in AWS.

# Notes used to generate this file ...

```

- create an organization then three new accounts within it called testing, staging and production

- create permission set
  - predefined, administrator access, NEXT
  - permission set name="new-permission-set", NEXT then CREATE

- create group
  - go to groups and hit CREATE GROUP
  - group name = "new-group", CREATE GROUP

- create user
  - got to users, hit ADD USER
  - email address - a real email address
  - first name = New, last name = User
  - generate a one-time password, NEXT
  - add user to group : new-group, NEXT
  - ADD USER
  - hit the COPY button to copy the one-time password, then CLOSE, and paste the buffer into a document (there is more than just the password .. you are going to have to extract it later)
  - press the VIEW USER DETAILS button (or go to the user in the users side panel)
  - press the button SEND EMAIL VERIFICATION LINK
  - press SEND if a dialog appears
  - go to your email and press the VERIFY button and you should be back in the management console with a "thank you you have been verified" message ... and a LOGIN button .. press LOGIN
  - you now login as new-user, enter the user name "new-user" and press next
  - paste in the password and hit next
  - enter a password
    - make a note of it
    - if you accept google's strong password it will be saved and automatically available next time :
    - this is a good idea
    - note that you may need to set the username to new-user in the google password manager screens!
  - you will now be logged in as new-user

- login as the root user again using the root login screen

- go to identity center and assign the group new-group permissions over the management account like this :
  - click on AWS ACCOUNTS in the sidebar
  - click on the tick next to the management account (whatever you named it)
  - press ASSIGN USERS OR GROUPS
  - click on the GROUPS tab and assign "new-group" and press NEXT
  - the next screen is "select permission sets" .. choose "new-permission-set" and press NEXT then SUBMIT
  - if you press "view details" in the green banner you should see 1 completed assignment provisioning
  - if you go to users->new-user and look in the AWS ACCOUNTS tab and click on the management account button radio-button on the left you should see new-permission-set appear as one of the permission sets on the right : this is good

- now repeat the above section to assign new-group permissions over the testing, staging and production accounts

- check :
  - if you go to to the AWS ACCOUNTS tab you should see that all 4 accounts are associated with "new-permission-set"
  - go to the USERs in the side panel, select "new-user" and go to the "AWS ACCOUNTS" tab and hit the refresh button (bottom right) and you should see all 4 accounts associated with this user now - and if you select an account you will see the new-permission-set assignment

- now login as new-user
  - whilst still logged in as root, go to the identity center dashboard
  - on the right hand side under the "AWS access portal URLs" copy the IPv4-only link
  - it something like this : https://d-9c67b1f327.awsapps.com/start
  - note it ends in "start" .. that's how to know its the right link !
  - this will take you to a login screen - enter username=new-user and the password you selected earlier
  - you are now presented with 4 options : for each of the 4 accounts
```
