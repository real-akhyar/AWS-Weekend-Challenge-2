# Weekend Creative Challenge: Compliment Creature

**Tag: #creative-expression**

## Vision and what the app does

Compliment Creature is a tiny creative app for the moments when a person needs a kind word but does not want another generic motivational quote. The idea is simple: a visitor chooses a creature, selects the kind of day they have had, and can add one small detail. The app then introduces a whimsical companion with a name, a supportive compliment, and an absurdly specific trait. For example, someone who finally sends a difficult email might meet an otter called Mallow, who congratulates them for doing the brave thing while their brain tried to make it feel enormous.

The creative output is a shareable creature card. The writing is generated fresh for each interaction, while the card uses hand-built visual themes and playful animal marks. I wanted the result to feel more like finding a tiny note in a pocket than talking to a chatbot. The app is deliberately narrow: it makes one small, positive thing well.

## How I built it

I started by reducing the idea to one interaction. The first version has only an animal picker, a day-type picker, an optional short detail field, and one button. Keeping the form constrained makes the app quick to use and also gives the text model enough direction to make a relevant response.

The frontend is plain HTML, CSS, and JavaScript. I chose this instead of a larger framework so the project could stay easy to understand, load quickly, and deploy as a static site. The visual design uses a paper-like background, expressive serif type, gradients, borders, and three predefined themes. The model does not create images; instead, its generated `theme` value selects a safe visual treatment already designed in CSS. This keeps the output attractive without adding cost, latency, or another AI service.

The main technical challenge was making model output reliable enough for a UI. I need the Lambda to receive structured data, not a paragraph with unpredictable formatting. I solved this by asking Amazon Nova Lite to return only JSON containing `name`, `compliment`, `trait`, and `theme`. The Lambda removes an accidental JSON code fence if one appears, parses the response, limits field lengths, and allows only the known visual themes. If the request or model response is invalid, the app returns a friendly error instead of exposing an AWS error message.

I also kept the optional memory detail limited to 160 characters. That gives people a personal touch without collecting more information than the app needs. The Lambda validates the animal and day options against lists that match the UI before making a Bedrock request.

## AWS services used and architecture overview

Compliment Creature uses Amazon Bedrock, AWS Lambda, Amazon API Gateway, Amazon S3, and Amazon CloudWatch.

```text
S3-hosted browser app
        |
        | HTTPS POST /generate
        v
API Gateway -> Lambda -> Amazon Bedrock / Amazon Nova Lite
                    |
                    v
             CloudWatch Logs
```

Amazon S3 hosts the static HTML, CSS, JavaScript, and configuration file. The browser sends the user selection to an Amazon API Gateway endpoint. API Gateway invokes a Node.js AWS Lambda function. Lambda validates the input and calls Amazon Bedrock with Amazon Nova Lite through the Converse API. The response travels back through API Gateway and is rendered as the creature card. CloudWatch receives Lambda logs for troubleshooting.

I used an AWS SAM template to define the API and Lambda deployment. The Lambda role uses least privilege: it only receives `bedrock:InvokeModel` for the configured Nova foundation model, rather than broad access to every Bedrock model. This approach keeps AWS credentials out of the browser because the Bedrock request happens only in Lambda.

## What I learned

This challenge taught me that an AI feature can be useful without becoming an entire chat interface. A strongly constrained prompt, a small schema, and careful validation make an AI-powered interaction feel intentional. I also learned how Amazon Bedrock's Converse API lets a Lambda function send a message to an Amazon Nova model and control output length and creativity through inference settings.

On the AWS side, I practised separating a public static interface from a private model invocation. S3 serves the visual app, API Gateway exposes a focused endpoint, and Lambda holds the AWS permissions. I also learned why IAM scope matters even in a small prototype: permission for one selected model is better than a wildcard policy.

The final result is small, but it is complete: it produces an original creative artifact, uses AWS services directly, and can be deployed on Free Tier-friendly services. Most importantly, it makes a person smile in a few seconds.

## Try it

Public repository: **REPLACE_WITH_YOUR_PUBLIC_GITHUB_REPOSITORY_URL**

Deployed app: **REPLACE_WITH_YOUR_DEPLOYED_S3_OR_CLOUDFRONT_URL_IF_AVAILABLE**

The public repository contains the complete frontend, Lambda source, AWS SAM infrastructure, and deployment instructions.
