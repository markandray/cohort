resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${var.project_name}"
  retention_in_days = 7 # short retention keeps CloudWatch Logs cost negligible for a demo deployment

  tags = {
    Name = "${var.project_name}-ecs-logs"
  }
}