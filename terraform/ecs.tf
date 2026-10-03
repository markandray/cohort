resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "disabled" # avoids the extra Container Insights CloudWatch cost for a demo cluster
  }

  tags = {
    Name = "${var.project_name}-cluster"
  }
}

resource "aws_ecs_task_definition" "server" {
  family                   = "${var.project_name}-server"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "server"
      image     = "${aws_ecr_repository.server.repository_url}:${var.image_tag}"
      essential = true
      portMappings = [
        { containerPort = 5000, protocol = "tcp" }
      ]
      environment = [
        { name = "PORT", value = "5000" },
        { name = "REDIS_URL", value = "redis://${aws_instance.redis.private_ip}:6379" },
        { name = "CORS_ORIGIN", value = var.cors_origin },
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = aws_ssm_parameter.database_url.arn },
        { name = "JWT_ACCESS_SECRET", valueFrom = aws_ssm_parameter.jwt_access_secret.arn },
        { name = "JWT_REFRESH_SECRET", valueFrom = aws_ssm_parameter.jwt_refresh_secret.arn },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "server"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-server-task"
  }
}

resource "aws_ecs_task_definition" "client" {
  family                   = "${var.project_name}-client"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "client"
      image     = "${aws_ecr_repository.client.repository_url}:${var.image_tag}"
      essential = true
      portMappings = [
        { containerPort = 3000, protocol = "tcp" }
      ]
      environment = [
        { name = "PORT", value = "3000" },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "client"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-client-task"
  }
}

resource "aws_ecs_service" "server" {
  name            = "${var.project_name}-server"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.server.arn
  desired_count   = var.server_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  # Lets you scale this service up/down directly via `aws ecs
  # update-service --desired-count N` for a quick test, without a
  # Terraform plan/apply reverting it back to 0 in the meantime.
  # `terraform destroy` still removes the service regardless of its
  # actual running count at the time.
  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = {
    Name = "${var.project_name}-server-service"
  }
}

resource "aws_ecs_service" "client" {
  name            = "${var.project_name}-client"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.client.arn
  desired_count   = var.client_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = {
    Name = "${var.project_name}-client-service"
  }
}

# No ALB, so these tasks are reached directly on their (dynamic) public
# IPs. Ingress defaults to 0.0.0.0/0 since this is meant to be reachable
# for a demo/viva from wherever you happen to be — tighten
# allowed_ingress_cidr to your own IP/32 if you want it locked down
# during a test window.
resource "aws_security_group_rule" "ecs_server_ingress" {
  type              = "ingress"
  from_port         = 5000
  to_port           = 5000
  protocol          = "tcp"
  cidr_blocks       = [var.allowed_ingress_cidr]
  security_group_id = aws_security_group.ecs.id
  description       = "Allow inbound to the server task (no ALB - direct access for this temporary demo deployment)"
}

resource "aws_security_group_rule" "ecs_client_ingress" {
  type              = "ingress"
  from_port         = 3000
  to_port           = 3000
  protocol          = "tcp"
  cidr_blocks       = [var.allowed_ingress_cidr]
  security_group_id = aws_security_group.ecs.id
  description       = "Allow inbound to the client task (no ALB - direct access for this temporary demo deployment)"
}