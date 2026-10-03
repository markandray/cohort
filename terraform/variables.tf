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

variable "jwt_access_secret" {
  type        = string
  sensitive   = true
  description = "Value for JWT_ACCESS_SECRET, stored as an SSM SecureString. Supply via terraform.tfvars, never commit."
}

variable "jwt_refresh_secret" {
  type        = string
  sensitive   = true
  description = "Value for JWT_REFRESH_SECRET, stored as an SSM SecureString. Supply via terraform.tfvars, never commit."
}

variable "cors_origin" {
  type        = string
  description = "The client's public origin (e.g. http://<client-ip>:3000), known only after the client task is actually running. Required — no safe default, since a wildcard origin doesn't work with the app's credentialed (cookie-based) CORS requests."
}

variable "image_tag" {
  type        = string
  default     = "latest"
  description = "ECR image tag to deploy for both services."
}

variable "server_desired_count" {
  type        = number
  default     = 0
  description = "Number of running server tasks. Defaults to 0 so applying this stage never bills for Fargate compute until you deliberately scale up."
}

variable "client_desired_count" {
  type        = number
  default     = 0
  description = "Number of running client tasks. Same zero-by-default reasoning as server_desired_count."
}

variable "allowed_ingress_cidr" {
  type        = string
  default     = "0.0.0.0/0"
  description = "CIDR allowed to reach the server/client tasks directly (no ALB). Tighten to your own IP/32 for a more locked-down test window if you want."
}