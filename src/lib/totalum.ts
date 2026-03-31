import 'server-only'; // Enforces server-only because totalum-api-sdk access to all database, and we can't expose that to client
import { TotalumApiSdk, type AuthOptions } from 'totalum-api-sdk';


const apiKey = process.env.TOTALUM_API_KEY || 'test-api-key';
const baseUrl = process.env.TOTALUM_API_URL || 'https://api.totalum.app/';


const options: AuthOptions = {
  apiKey: { 'api-key': apiKey }
};

export const totalumSdk = new TotalumApiSdk(options);


totalumSdk.changeBaseUrl(baseUrl);
