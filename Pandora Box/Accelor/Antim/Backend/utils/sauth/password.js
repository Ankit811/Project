import { hash, compare } from 'bcrypt';

const hashPassword = async (password) => {
  return await hash(password, 10);
};

const validatePassword = async (plainPassword, hashedPassword) => {
  return await compare(plainPassword, hashedPassword);
};

export  { hashPassword, validatePassword };
