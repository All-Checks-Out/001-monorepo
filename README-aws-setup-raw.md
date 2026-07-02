# setup

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
