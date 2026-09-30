provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "cohort"
      ManagedBy = "terraform"
    }
  }
}