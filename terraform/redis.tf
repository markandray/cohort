# Amazon Linux 2023 AMI, looked up dynamically so this doesn't hardcode
# a region-specific, eventually-stale AMI ID.
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "redis" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.redis.id]

  user_data = <<-EOF
    #!/bin/bash
    dnf install -y docker
    systemctl enable docker
    systemctl start docker
    docker run -d --name redis --restart unless-stopped -p 6379:6379 redis:7-alpine
  EOF

  tags = {
    Name = "${var.project_name}-redis"
  }
}

resource "aws_security_group_rule" "redis_from_ecs" {
  type                     = "ingress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs.id
  security_group_id        = aws_security_group.redis.id
  description              = "Allow Redis from ECS tasks only"
}