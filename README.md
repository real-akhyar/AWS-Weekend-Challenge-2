# Compliment Creature

Compliment Creature is a tiny creative app for the AWS Weekend Creative Challenge. Pick an animal, describe the kind of day you had, and receive a whimsical creature with an original compliment and odd little talent.

It is intentionally small: one page, one API endpoint, and one creative moment. The frontend supplies the visual creature card, while Amazon Bedrock creates the words.

## AWS architecture

```text
Static browser app (Amazon S3)
          |
          | POST /generate
          v
Amazon API Gateway -> AWS Lambda -> Amazon Bedrock (Amazon Nova Lite)
                              |
                              v
                       Amazon CloudWatch Logs
```

The Lambda function validates the form inputs, sends a constrained prompt to Amazon Bedrock's Converse API, validates the returned JSON, and returns the name, compliment, trait, and visual theme. The Lambda execution role has `bedrock:InvokeModel` permission only for the model supplied by the SAM parameter.

## Run the frontend locally

The frontend has no build step. Open `frontend/index.html` in a browser, or serve it locally with any static web server. The Generate button will explain that configuration is needed until the API URL is added.

## Deploy the API

Prerequisites:

- An AWS account and AWS CLI credentials
- AWS SAM CLI
- Node.js 20 or later
- Amazon Bedrock model access enabled for `amazon.nova-lite-v1:0` in your chosen Region

From the project root:

```bash
sam build --template-file infrastructure/template.yaml
sam deploy --guided --template-file infrastructure/template.yaml
```

During the guided deploy, choose a Region where Amazon Nova Lite is available and model access is enabled. Copy the `GenerateApiUrl` output into `frontend/config.js`:

```js
window.COMPLIMENT_CREATURE_API_URL = "https://your-api-id.execute-api.your-region.amazonaws.com/Prod/generate";
```

## Host the frontend on S3

1. Create an S3 bucket in the same Region or your preferred web-hosting Region.
2. Enable static website hosting and set `index.html` as the index document.
3. Upload the contents of `frontend/`, including the edited `config.js`.
4. Make the website readable publicly, or serve the bucket privately through CloudFront with Origin Access Control.
5. Open the website URL and generate a creature.

For a quick upload after creating the bucket:

```bash
aws s3 sync frontend/ s3://YOUR_BUCKET_NAME/ --delete
```

## Test checklist

- Choose an animal and day type, then generate a creature.
- Try the optional detail field with a short personal accomplishment.
- Confirm the returned card has a name, compliment, trait, and changing visual theme.
- Test the copy button and narrow mobile layout.
- Check Lambda errors in CloudWatch Logs if generation fails.

## Project layout

```text
frontend/                 Static browser app
backend/generate/         Lambda handler and dependencies
infrastructure/           AWS SAM template
ARTICLE.md                Ready-to-publish challenge article
```

