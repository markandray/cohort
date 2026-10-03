# RDS requires a "DB subnet group" spanning at least 2 AZs, even for a
# single-AZ instance — this is what places it in the private subnets.
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-db-subnet-group"
  }
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-db"
  engine         = "postgres"
  engine_version = "16"
  instance_class = "db.t3.micro"

  allocated_storage     = 20
  storage_type          = "gp3"
  max_allocated_storage = 0 # disable storage autoscaling — keep cost predictable

  db_name  = "cohort_prod"
  username = "postgres"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  multi_az            = false # single-AZ: this is a demo deployment, stood up and torn down per session, not a durability-critical workload
  publicly_accessible = false # defense in depth alongside the private subnet placement — no public IP even if a route existed

  backup_retention_period = 0    # no automated backups — matches the "stand up, verify, destroy" lifecycle; nothing here needs to survive terraform destroy
  skip_final_snapshot     = true # required alongside the above — otherwise `terraform destroy` fails waiting for a final snapshot

  deletion_protection = false # must be destroyable via `terraform destroy` without a manual override

  tags = {
    Name = "${var.project_name}-db"
  }
}

resource "aws_security_group_rule" "rds_from_ecs" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs.id
  security_group_id        = aws_security_group.rds.id
  description              = "Allow Postgres from ECS tasks only"
}