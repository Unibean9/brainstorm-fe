import type { ApiResponse } from "@/types/api";
import type { BrainstormAgentOption } from "@/types/brainstorm-domain";

import apiService from "../core";

const BASE = "api/v1/brainstorm/agents";

export const agentsApi = {
  list: async (): Promise<BrainstormAgentOption[]> => {
    const response = await apiService.get<ApiResponse<BrainstormAgentOption[]>>(BASE);
    return response.data.data;
  },
};
