# One secret holding the full connection string, rather than separate
# host/user/password parameters — the app just needs DATABASE_URL as a
# single env var, so this is the simplest shape that matches how it's
# actually consumed.
resource "aws_ssm_parameter" "database_url" {
  name  = "/${var.project_name}/database_url"
  type  = "SecureString"
  value = "postgresql://${aws_db_instance.main.username}:${var.db_password}@${aws_db_instance.main.address}:5432/${aws_db_instance.main.db_name}"

  tags = {
    Name = "${var.project_name}-database-url"
  }
}

resource "aws_ssm_parameter" "jwt_access_secret" {
  name  = "/${var.project_name}/jwt_access_secret"
  type  = "SecureString"
  value = var.jwt_access_secret

  tags = {
    Name = "${var.project_name}-jwt-access-secret"
  }
}

resource "aws_ssm_parameter" "jwt_refresh_secret" {
  name  = "/${var.project_name}/jwt_refresh_secret"
  type  = "SecureString"
  value = var.jwt_refresh_secret

  tags = {
    Name = "${var.project_name}-jwt-refresh-secret"
  }
}