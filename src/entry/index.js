import { checkMyntraDiscount } from "../myntra/checkDiscount.js";
import dotenv from 'dotenv';
dotenv.config();

(async () => {
    await checkMyntraDiscount();
    process.exit(0);
})();