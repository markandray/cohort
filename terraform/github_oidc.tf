# AWS validates GitHub's OIDC provider against its own trusted root CA
# bundle (since July 2023), not against this thumbprint — but the
# Terraform resource still requires the argument. Fetching it dynamically
# means this file never depends on a hardcoded value going stale.
data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]

  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]

  tags = {
    Name = "${var.project_name}-github-oidc"
  }
}

# The role GitHub Actions will assume. Trust policy restricts this to
# runs of push-to-ecr.yml specifically on main, matched against this
# repo's immutable numeric IDs (not its current name) — this is the
# subject-claim format this GitHub account/repo actually issues.
# Note: scoped to ref:refs/heads/main exactly (StringEquals, not a
# wildcard pattern) — a run from any other branch or tag will need
# this condition updated.
resource "aws_iam_role" "github_actions" {
  name = "${var.project_name}-github-actions-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
            "token.actions.githubusercontent.com:sub" = "repo:markandray@224986735/cohort@1392252379:ref:refs/heads/main"
          }
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-github-actions-role"
  }
}

# Scoped narrowly to ECR push/pull on just the two repos this project
# uses — not AdministratorAccess, not even ecr:* on every repo in the
# account. GitHub Actions should be able to do exactly one thing: push
# images here.
resource "aws_iam_role_policy" "github_actions_ecr" {
  name = "${var.project_name}-github-actions-ecr-policy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
        ]
        Resource = [
          aws_ecr_repository.server.arn,
          aws_ecr_repository.client.arn,
        ]
      }
    ]
  })
}