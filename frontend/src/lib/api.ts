// Helper to get API URL dynamically based on current browser host
export const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // If running in browser, dynamically use current host with port 4000
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    // For cloudflare tunnel or other reverse proxy configurations,
    // it's highly recommended to use NEXT_PUBLIC_API_URL instead.
    // If not set, we assume backend is accessible at port 4000 on the same host.
    return `${protocol}//${hostname}:4000/api`;
  }

  // Fallback for SSR
  return 'http://localhost:4000/api';
};

const API_URL = getApiUrl();

const getHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('nvr_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
};

const handleResponse = async (res: Response) => {
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('nvr_token');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new Error(`API request failed with status ${res.status}`);
  }

  return res.json();
};

export const fetchCameras = async () => {
  const res = await fetch(`${API_URL}/cameras`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
};

export const createCamera = async (cameraData: any) => {
  const res = await fetch(`${API_URL}/cameras`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(cameraData),
  });
  return handleResponse(res);
};

export const deleteCamera = async (id: string) => {
  const res = await fetch(`${API_URL}/cameras/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  return handleResponse(res);
};

export const updateCamera = async (id: string, cameraData: any) => {
  const res = await fetch(`${API_URL}/cameras/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(cameraData),
  });
  return handleResponse(res);
};

export const startCameraDecoder = async (id: string) => {
  const res = await fetch(`${API_URL}/cameras/${id}/start`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse(res);
};

export const stopCameraDecoder = async (id: string) => {
  const res = await fetch(`${API_URL}/cameras/${id}/stop`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse(res);
};

export const toggleCameraRecording = async (id: string, isRecording: boolean) => {
  const res = await fetch(`${API_URL}/cameras/${id}/record`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ isRecording }),
  });
  return handleResponse(res);
};
export const fetchLogs = async (type = 'all', module = 'all-modules', limit = 100) => {
  const params = new URLSearchParams({ type, module, limit: limit.toString() });
  const res = await fetch(`${API_URL}/logs?${params.toString()}`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
};

export const fetchRecordings = async (date?: string) => {
  const params = date ? `?date=${date}` : '';
  const res = await fetch(`${API_URL}/recordings${params}`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
};

// Layout Preferences API
export const getLiveLayout = async () => {
  const res = await fetch(`${API_URL}/preferences/live-layout`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
};

export const saveLiveLayout = async (gridSize: number, cellMap: Record<number, string>) => {
  const res = await fetch(`${API_URL}/preferences/live-layout`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ gridSize, cellMap }),
  });
  return handleResponse(res);
};

// PTZ API
export const sendPtzCommand = async (id: string, command: string) => {
  const res = await fetch(`${API_URL}/cameras/${id}/ptz`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ command }),
  });
  return handleResponse(res);
};

// System Configuration API
export const getSystemConfig = async () => {
  const res = await fetch(`${API_URL}/system/config`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
};

export const updateSystemConfig = async (configData: Record<string, any>) => {
  const res = await fetch(`${API_URL}/system/config`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(configData),
  });
  return handleResponse(res);
};

// Users Management API
export const fetchUsers = async () => {
  const res = await fetch(`${API_URL}/users`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
};

export const createUser = async (userData: any) => {
  const res = await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(userData),
  });
  return handleResponse(res);
};

export const updateUser = async (id: string, userData: any) => {
  const res = await fetch(`${API_URL}/users/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(userData),
  });
  return handleResponse(res);
};

export const deleteUser = async (id: string) => {
  const res = await fetch(`${API_URL}/users/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  return handleResponse(res);
};
