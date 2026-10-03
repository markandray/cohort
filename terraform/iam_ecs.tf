# Execution role: used by ECS itself (not your app code) to pull images
# from ECR, write logs to CloudWatch, and fetch/decrypt the SSM secrets
# at task launch.
resource "aws_iam_role" "ecs_execution" {
  name = "${var.project_name}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Name = "${var.project_name}-ecs-execution-role"
  }
}

# AWS-managed policy covering exactly ECR pull + CloudWatch Logs write —
# the standard baseline every ECS execution role needs.
resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Additional inline policy: fetch + decrypt the three SSM SecureString
# parameters. Scoped kms:Decrypt via ViaService rather than depending on
# a data-source lookup of the default aws/ssm key, which can be flaky on
# an account's very first SecureString usage.
resource "aws_iam_role_policy" "ecs_execution_ssm" {
  name = "${var.project_name}-ecs-execution-ssm-policy"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["ssm:GetParameters"]
        Resource = [
          aws_ssm_parameter.database_url.arn,
          aws_ssm_parameter.jwt_access_secret.arn,
          aws_ssm_parameter.jwt_refresh_secret.arn,
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "ssm.${var.aws_region}.amazonaws.com"
          }
        }
      }
    ]
  })
}

# Task role: used by the running container itself for any AWS API calls
# from application code. Currently empty/unused — Cohort's app code makes
# no AWS SDK calls — but ECS task defs conventionally reference one, and
# it's here ready for if that ever changes (e.g. S3 for file uploads).
resource "aws_iam_role" "ecs_task" {
  name = "${var.project_name}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Name = "${var.project_name}-ecs-task-role"
  }
}