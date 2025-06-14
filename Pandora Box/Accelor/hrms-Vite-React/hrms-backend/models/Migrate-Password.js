import { connect, disconnect } from 'mongoose';
import { hash } from 'bcrypt';
import Employee from '../models/Employee';

async function hashExistingPasswords() {
  try {
    // Connect to MongoDB
    await connect('mongodb://localhost:27017/hrms', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Find all employees
    const employees = await Employee.find();
    let updatedCount = 0;

    for (const employee of employees) {
      // Check if password is not already hashed (bcrypt hashes start with $2b$)
      if (!employee.password.startsWith('$2b$')) {
        console.log(`Hashing password for employee: ${employee.email}`);
        employee.password = await hash(employee.password, 10);
        await employee.save();
        updatedCount++;
      }
    }

    console.log(`Migration completed. Updated ${updatedCount} employee passwords.`);
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await disconnect();
  }
}

export default hashExistingPasswords;