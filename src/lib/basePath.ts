const BASE_PATH = process.env.NODE_ENV === 'production' ? '/war-shape' : '';
export const withBasePath = (path: string) => `${BASE_PATH}${path}`;
