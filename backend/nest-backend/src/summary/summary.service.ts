import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SummaryService {
  async getSummary(data: any) {
    try {
      const response = await axios.post("http://localhost:8000/ai-summary", {
        balances: data.balances,
        primaryUser: data.primaryUser,
      });

      return response.data;
    } catch (error) {
      console.error(error);
      return { summary: 'Unable to generate summary' };
    }
  }
}
