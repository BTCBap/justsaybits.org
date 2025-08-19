# justsaybits.org

## To run this project in development

`npm run dev`

## To deploy this project to github pages

We have installed the `gh-pages` npm package as a development dependency which provides a command line utility that will automate pushing and deploying to github pages.

Once you have made changes you are happy with run the deploy script which will run the predeploy script first to build the static content and then will push the bundled app to the GitHub repository:
`npm run deploy`.

You should see a branch called `gh-pages` on GitHub.

Ensure the Builde and deployment section of "Pages" within the "Settings" tab is set to the correct branch.  Use `gh-pages`.

To see the status of a deployment, head to the "Actions" tab in Github. There you can click on the latest deployment and see the status of your jobs.  Once all jobs turn green, you can check out your newly deployed site.

Make sure to keep your main branch up to date. Add, commit, and push changes like normal to the main branch.  Just know your site won't redeploy until the deploy script is run and gh-pages branch is updated on github. If you make changes to a file that doesn't affect your project, like the ReadMe you don't need to rerun the deploy script, but be sure to push the changes to the github main branch.
