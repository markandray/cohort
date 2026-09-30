variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "project_name" {
  type    = string
  default = "cohort"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "availability_zones" {
  type    = list(string)
  default = ["ap-south-1a", "ap-south-1b"]
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.11.0/24", "10.0.12.0/24"]
}

variable "github_repo" {
  type        = string
  description = "GitHub repo allowed to assume the OIDC role, as owner/repo"
  default     = "markandray/cohort"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "Master password for the RDS PostgreSQL instance. Supply via -var or a gitignored .tfvars file, never commit."
}