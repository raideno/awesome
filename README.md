# Awesome Website - https://raideno.github.io/awesome

Awesome website is a project that transforms a simple YAML file into a beautiful, interactive, and easily deployable website to store your resources (links, images, files, etc) directly inside your github repository. It's the perfect solution for creating and maintaining "awesome lists" with a polished and professional look.

Using your GitHub token you can then update the website directly from within the website itself, without the need to edit the YAML file manually. This makes it easy to keep your awesome list up-to-date and share it with others.

## Automatic Setup

1. Fork the [**Template Repository**](https://github.com/raideno/easy-awesome).
2. Enable the github pages in the repository's settings (`Settings > Pages > Build and Deployment > Source > GitHub Actions).
3. Run the github action to deploy the website.
4. Modify the awesome list as you want.

## Manual Setup

1. Create a github repository with a `list.yaml` file containing your awesome list. Follow the [schema](#yaml-file-structure) or copy the [example list](packages/website/example.list.yaml).
2. Enable the github pages in the repository's settings (`Settings > Pages > Build and Deployment > Source > GitHub Actions).
3. Copy the github action to build the website `.github/workflows/deploy-awesome-website.yml`.
```yaml
# .github/workflows/deploy-awesome-website.yml
name: Deploy Awesome Website to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: write
    steps:
      - name: checkout repository
        uses: actions/checkout@v4

      - name: build awesome website
        uses: raideno/awesome@v0.2.1
        with:
          # NOTE: formatted according to the structure specified below
          yaml-path: 'example.list.yaml'

      - name: upload build artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: awesome-src/dist
          name: github-pages

      - name: deploy to github pages
        id: deployment
        uses: actions/deploy-pages@v4
        with:
          artifact_name: github-pages
```
4. Push your changes and wait for the github action to complete in order to see your changes.

Your new awesome list website will be available at `https://<your-username>.github.io/<your-repository-name>/`. To edit it you can either use the website directly or by editing the `list.yml` file.

## YAML File Structure

The `example.list.yaml` file has a clear structure that's easy to understand and modify. Below is a breakdown of each section and its purpose.

| Field         | Type                 | Description                                                             |
| :------------ | :------------------- | :---------------------------------------------------------------------- |
| `title`       | String               | The main title of your awesome list.                                    |
| `description` | String               | A short description of your list that will appear in the header.        |
| `author`      | String               | The name of the primary author of the list.                             |
| `thumbnail`   | URL                  | An optional URL for a thumbnail image to be displayed in the header.    |
| `links`       | Array of Url Strings | A list of additional links to be displayed in the header.               |
| `elements`    | Array of Objects     | The core of your awesome list, where each object represents a resource. |


### Element Object Structure

| Field         | Type             | Description                                                             |
| :------------ | :--------------- | :---------------------------------------------------------------------- |
| `id`          | String           | A unique id to identify the resource.                                   |
| `name`        | String           | The name of the resource.                                               |
| `description` | String           | A short description of the resource.                                    |
| `link`        | Url              | A relevant URL for the resource (e.g., website, GitHub, documentation). |
| `tags`        | Array of Strings | A list of tags specific to this resource for filtering.                 |
| `notes`       | String           | A long detailed notes that support markdown and latex.                  |
| `group`       | String           | The group to which belongs this element.                                |

## Deployment

This project includes a GitHub Actions workflow that automatically builds and deploys your website to GitHub Pages. The workflow is triggered every time you push a change to the `main` branch.

To enable automated deployments, make sure to configure GitHub Pages to use the "GitHub Actions" source in your repository's settings.

## Contribution & Development

Copy the [`.env.example`](./.env.example) file to `.env` and fill in the required values.

- Development: `npm run dev`
- Build: `npm run build`
- Start Build: `npm run start`

Do your changes in a separate branch and create a pull request to merge them into the `main` branch or `develop` branch if you are working on a feature. In order to push a new version of the action / website, simply push a new tag with the version number (e.g., `v0.2.1`) and the GitHub Action will automatically build and publish the new version to the GitHub Marketplace.
