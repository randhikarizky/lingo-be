import { User } from "@prisma/client";
import { UserEntity } from "../../domain/entities/user.entity";

export function toUserEntity(user: User): UserEntity {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}
