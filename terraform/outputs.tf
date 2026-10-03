output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "ecs_security_group_id" {
  value = aws_security_group.ecs.id
}

output "rds_security_group_id" {
  value = aws_security_group.rds.id
}

output "redis_security_group_id" {
  value = aws_security_group.redis.id
}

output "ecr_server_repository_url" {
  value = aws_ecr_repository.server.repository_url
}

output "ecr_client_repository_url" {
  value = aws_ecr_repository.client.repository_url
}

output "github_actions_role_arn" {
  value = aws_iam_role.github_actions.arn
}

output "rds_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "rds_address" {
  value = aws_db_instance.main.address
}

output "redis_private_ip" {
  value = aws_instance.redis.private_ip
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_server_service_name" {
  value = aws_ecs_service.server.name
}

output "ecs_client_service_name" {
  value = aws_ecs_service.client.name
}

output "cloudwatch_log_group_name" {
  value = aws_cloudwatch_log_group.ecs.name
}

# A running Fargate task's public IP is assigned to its ENI at launch —
# it's not a static Terraform-managed value, so it can't be a normal
# output. Once you scale a service up, fetch it with:
#
#   aws ecs list-tasks --cluster <ecs_cluster_name> --service-name <service name>
#   aws ecs describe-tasks --cluster <ecs_cluster_name> --tasks <task ARN from above>
#     (look for the "networkInterfaceId" in the attachment details, then:)
#   aws ec2 describe-network-interfaces --network-interface-ids <that ID>
#     (the "Association.PublicIp" field is the task's public IP)