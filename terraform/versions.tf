terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Local state, per the earlier decision: single developer, ephemeral
  # build-verify-destroy workflow, no team to coordinate with. No S3/DynamoDB
  # backend infrastructure just to store state for infra that won't exist
  # most of the time.
  backend "local" {
    path = "terraform.tfstate"
  }
}