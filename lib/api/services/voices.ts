import type { ApiResponse } from "@/types/api";
import type { BrainstormVoice } from "@/types/brainstorm-domain";

import apiService from "../core";

const BASE = "api/v1/brainstorm/voices";

export const voicesApi = {
  /** Public — không cần header. Preset hiện có: vi-female-01, vi-male-01. */
  list: async (): Promise<BrainstormVoice[]> => {
    const response = await apiService.get<ApiResponse<BrainstormVoice[]>>(BASE);
    return response.data.data;
  },
};
