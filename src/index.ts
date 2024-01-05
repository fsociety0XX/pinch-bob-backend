import dotenv from 'dotenv-safe';
import addNumbers from '@src/math/add';

dotenv.config();

console.log(addNumbers(1, 2), 'answer');
