import type { ApiResponse } from "@/types/api";
import type { RuntimeProviderOption } from "@/types/brainstorm-domain";

import apiService from "../core";

const BASE = "api/v1/brainstorm/runtime-providers";

/** Runtime provider is infrastructure pinned to the room, not a facilitation mode. */
export const runtimeProvidersApi = {
  list: async (): Promise<RuntimeProviderOption[]> => {
    const response = await apiService.get<ApiResponse<RuntimeProviderOption[]>>(BASE);
    return response.data.data;
  },
};
