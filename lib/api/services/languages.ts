import type { ApiResponse } from "@/types/api";
import type { BrainstormLanguageOption } from "@/types/brainstorm-domain";

import apiService from "../core";

const BASE = "api/v1/brainstorm/languages";

export const languagesApi = {
  list: async (): Promise<BrainstormLanguageOption[]> => {
    const response = await apiService.get<ApiResponse<BrainstormLanguageOption[]>>(BASE);
    return response.data.data;
  },
};
