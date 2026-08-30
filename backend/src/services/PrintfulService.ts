import axios from 'axios';
import { env } from '../config/env';
import { AppError } from '../api/middleware/errorHandler';
import { logger } from '../utils/logger';

interface ShippingInfo {
  name: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface CreatePrintfulOrderInput {
  externalId: string;
  productType: string;
  size?: string;
  color?: string;
  quantity: number;
  artworkUrl: string;
  shippingInfo: ShippingInfo;
}

interface PrintfulOrderResult {
  id: string;
  status?: string;
}

interface CreatePrintfulMockupPreviewInput {
  productType: string;
  size?: string;
  color?: string;
  artworkUrl: string;
}

interface PrintfulMockupPreviewResult {
  previewUrl: string;
}

interface PrintfulRequestConfig {
  headers: Record<string, string>;
  params?: Record<string, string>;
  timeout: number;
}

interface PrintfulOrderResponseData {
  id?: string | number;
  status?: string;
}

interface PrintfulMockupTaskResponseData {
  task_key?: string;
  status?: string;
  error?: string;
}

type ParsedIntegerMap = Record<string, number>;

interface PrintfulMockupTemplateInfo {
  template_id: number;
  print_area_width: number;
  print_area_height: number;
  print_area_top: number;
  print_area_left: number;
}

interface PrintfulMockupTemplateResponse {
  variant_mapping?: Array<{
    variant_id?: number;
    templates?: Array<{
      placement?: string;
      template_id?: number;
    }>;
  }>;
  templates?: PrintfulMockupTemplateInfo[];
}

function normalizeKeyPart(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return normalized && normalized.length > 0 ? normalized : null;
}

function resolvePlacement(productType: string): { placement: string; technique: string } {
  const productKey = normalizeKeyPart(productType);

  switch (productKey) {
    case 'print':
      return { placement: 'default', technique: 'digital' };
    case 'phone-case':
      return { placement: 'default', technique: 'uv' };
    case 'desk-mat':
      return { placement: 'default', technique: 'sublimation' };
    default:
      throw new AppError(
        `Printful placement mapping is missing for ${productType}`,
        400,
        'PRINTFUL_PLACEMENT_MISSING'
      );
  }
}

function parseIntegerMap(rawValue: string | undefined, envKey: string): ParsedIntegerMap {
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${envKey} must be a JSON object`);
    }

    return Object.entries(parsed).reduce<ParsedIntegerMap>((accumulator, [key, value]) => {
      const numericValue = typeof value === 'string' ? Number(value) : value;
      if (typeof numericValue !== 'number' || !Number.isInteger(numericValue)) {
        throw new Error(`${envKey}.${key} must be an integer ID`);
      }
      accumulator[key] = numericValue;
      return accumulator;
    }, {});
  } catch (error) {
    logger.error(`[PrintfulService] Invalid ${envKey} config`, error);
    throw new AppError('Printful variant mapping is invalid', 500, 'PRINTFUL_MAPPING_INVALID');
  }
}

function parseVariantMap(): ParsedIntegerMap {
  return parseIntegerMap(env.PRINTFUL_VARIANT_IDS, 'PRINTFUL_VARIANT_IDS');
}

function parseMockupTemplateMap(): ParsedIntegerMap {
  try {
    return parseIntegerMap(env.PRINTFUL_MOCKUP_TEMPLATE_IDS, 'PRINTFUL_MOCKUP_TEMPLATE_IDS');
  } catch (error) {
    if (error instanceof AppError) {
      throw new AppError('Printful mockup template mapping is invalid', 500, 'PRINTFUL_TEMPLATE_INVALID');
    }
    throw error;
  }
}

export function isPrintfulOrderCreationEnabled(): boolean {
  return env.PRINTFUL_CREATE_ORDERS === true;
}

export function resolvePrintfulMockupTemplateId(
  productType: string,
  size?: string,
  color?: string
): number {
  const templateMap = parseMockupTemplateMap();
  const productKey = normalizeKeyPart(productType);
  const sizeKey = normalizeKeyPart(size);
  const colorKey = normalizeKeyPart(color);

  const candidates = [
    [productKey, sizeKey, colorKey].filter(Boolean).join(':'),
    [productKey, sizeKey].filter(Boolean).join(':'),
    [productKey, colorKey].filter(Boolean).join(':'),
    productKey,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const templateId = templateMap[candidate];
    if (templateId) {
      return templateId;
    }
  }

  throw new AppError(
    `Printful mockup template mapping is missing for ${productType}`,
    400,
    'PRINTFUL_TEMPLATE_MISSING'
  );
}

export function resolvePrintfulVariantId(
  productType: string,
  size?: string,
  color?: string
): number {
  const variantMap = parseVariantMap();
  const productKey = normalizeKeyPart(productType);
  const sizeKey = normalizeKeyPart(size);
  const colorKey = normalizeKeyPart(color);

  const candidates = [
    [productKey, sizeKey, colorKey].filter(Boolean).join(':'),
    [productKey, sizeKey].filter(Boolean).join(':'),
    [productKey, colorKey].filter(Boolean).join(':'),
    productKey,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const variantId = variantMap[candidate];
    if (variantId) {
      return variantId;
    }
  }

  throw new AppError(
    `Printful variant mapping is missing for ${productType}`,
    400,
    'PRINTFUL_MAPPING_MISSING'
  );
}

function getPrintfulRequestConfig(): PrintfulRequestConfig {
  return {
    headers: {
      Authorization: `Bearer ${env.PRINTFUL_API_KEY}`,
    },
    ...(env.PRINTFUL_STORE_ID ? { params: { store_id: env.PRINTFUL_STORE_ID } } : {}),
    timeout: 30000,
  };
}

function extractOrderData(response: unknown): PrintfulOrderResponseData {
  const payload = response as { data?: { data?: PrintfulOrderResponseData; result?: PrintfulOrderResponseData } };
  return payload?.data?.data ?? payload?.data?.result ?? {};
}

function extractTaskData(response: unknown): PrintfulMockupTaskResponseData {
  const payload = response as {
    data?: {
      data?: PrintfulMockupTaskResponseData;
      result?: PrintfulMockupTaskResponseData;
    };
  };
  return payload?.data?.data ?? payload?.data?.result ?? {};
}

function extractTemplateData(response: unknown): PrintfulMockupTemplateResponse {
  const payload = response as {
    data?: {
      data?: PrintfulMockupTemplateResponse;
      result?: PrintfulMockupTemplateResponse;
    };
  };
  return payload?.data?.data ?? payload?.data?.result ?? {};
}

function extractMockupPreviewUrl(response: unknown): string | null {
  const payload = response as {
    data?: {
      data?: any;
      result?: any;
    };
  };
  const body = payload?.data?.data ?? payload?.data?.result ?? {};

  const candidates = [
    body?.mockups?.[0]?.mockup_url,
    body?.mockups?.[0]?.url,
    body?.products?.[0]?.mockups?.[0]?.mockup_url,
    body?.products?.[0]?.mockups?.[0]?.url,
    body?.files?.[0]?.preview_url,
    body?.files?.[0]?.url,
  ];

  return candidates.find((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0) ?? null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchPrintfulTemplatePosition(
  productTemplateId: number,
  variantId: number,
  placement: string,
  requestConfig: PrintfulRequestConfig
): Promise<{
  area_width: number;
  area_height: number;
  width: number;
  height: number;
  top: number;
  left: number;
}> {
  let templateResponse;
  try {
    templateResponse = await axios.get(
      `https://api.printful.com/mockup-generator/templates/${productTemplateId}`,
      requestConfig
    );
  } catch (error) {
    logger.error('[PrintfulService] Printful template metadata request failed', error);
    throw new AppError('Printful template metadata request failed', 502, 'PRINTFUL_TEMPLATE_FETCH_FAILED');
  }

  const templateData = extractTemplateData(templateResponse);
  const templateId = templateData.variant_mapping
    ?.find((entry) => entry.variant_id === variantId)
    ?.templates?.find((entry) => entry.placement === placement)
    ?.template_id;

  const template = templateData.templates?.find((entry) => entry.template_id === templateId);
  if (!template) {
    throw new AppError('Printful template metadata is incomplete', 502, 'PRINTFUL_TEMPLATE_BAD_RESPONSE');
  }

  return {
    area_width: Math.round(template.print_area_width),
    area_height: Math.round(template.print_area_height),
    width: Math.round(template.print_area_width),
    height: Math.round(template.print_area_height),
    top: Math.round(template.print_area_top),
    left: Math.round(template.print_area_left),
  };
}

export async function createPrintfulMockupPreview({
  productType,
  size,
  color,
  artworkUrl,
}: CreatePrintfulMockupPreviewInput): Promise<PrintfulMockupPreviewResult> {
  if (!env.PRINTFUL_API_KEY) {
    throw new AppError('Printful API key is not configured', 500, 'PRINTFUL_NOT_CONFIGURED');
  }

  const productTemplateId = resolvePrintfulMockupTemplateId(productType, size, color);
  const variantId = resolvePrintfulVariantId(productType, size, color);
  const placement = resolvePlacement(productType);
  const requestConfig = getPrintfulRequestConfig();
  const position = await fetchPrintfulTemplatePosition(
    productTemplateId,
    variantId,
    placement.placement,
    requestConfig
  );

  let createTaskResponse;
  try {
    createTaskResponse = await axios.post(
      `https://api.printful.com/mockup-generator/create-task/${productTemplateId}`,
      {
        variant_ids: [variantId],
        format: 'jpg',
        files: [
          {
            placement: placement.placement,
            image_url: artworkUrl,
            position,
          },
        ],
      },
      requestConfig
    );
  } catch (error) {
    logger.error('[PrintfulService] Printful mockup task creation failed', error);
    throw new AppError('Printful mockup generation failed', 502, 'PRINTFUL_MOCKUP_CREATE_FAILED');
  }

  const createdTask = extractTaskData(createTaskResponse);
  if (!createdTask.task_key) {
    throw new AppError('Printful did not return a mockup task key', 502, 'PRINTFUL_BAD_RESPONSE');
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (attempt > 0) {
      await delay(1000);
    }

    let taskStatusResponse;
    try {
      taskStatusResponse = await axios.get('https://api.printful.com/mockup-generator/task', {
        ...requestConfig,
        params: {
          ...(requestConfig.params ?? {}),
          task_key: createdTask.task_key,
        },
      });
    } catch (error) {
      logger.error('[PrintfulService] Printful mockup task polling failed', error);
      throw new AppError('Printful mockup polling failed', 502, 'PRINTFUL_MOCKUP_POLL_FAILED');
    }

    const taskStatus = extractTaskData(taskStatusResponse);
    if (taskStatus.status === 'failed') {
      logger.error('[PrintfulService] Printful mockup task failed', {
        taskKey: createdTask.task_key,
        error: taskStatus.error,
      });
      throw new AppError(
        taskStatus.error
          ? `Printful mockup generation failed: ${taskStatus.error}`
          : 'Printful mockup generation failed',
        502,
        'PRINTFUL_MOCKUP_FAILED'
      );
    }

    const previewUrl = extractMockupPreviewUrl(taskStatusResponse);
    if (previewUrl) {
      return { previewUrl };
    }
  }

  throw new AppError('Printful mockup generation timed out', 504, 'PRINTFUL_MOCKUP_TIMEOUT');
}

export async function createPrintfulOrder({
  externalId,
  productType,
  size,
  color,
  quantity,
  artworkUrl,
  shippingInfo,
}: CreatePrintfulOrderInput): Promise<PrintfulOrderResult> {
  if (!env.PRINTFUL_API_KEY) {
    throw new AppError('Printful API key is not configured', 500, 'PRINTFUL_NOT_CONFIGURED');
  }

  const catalogVariantId = resolvePrintfulVariantId(productType, size, color);
  const placement = resolvePlacement(productType);
  const requestConfig = getPrintfulRequestConfig();

  let response;
  try {
    response = await axios.post(
      'https://api.printful.com/v2/orders',
      {
        external_id: externalId,
        recipient: {
          name: shippingInfo.name,
          email: shippingInfo.email,
          address1: shippingInfo.addressLine1,
          address2: shippingInfo.addressLine2 ?? undefined,
          city: shippingInfo.city,
          state_code: shippingInfo.state,
          country_code: shippingInfo.country,
          zip: shippingInfo.postalCode,
        },
        order_items: [
          {
            source: 'catalog',
            catalog_variant_id: catalogVariantId,
            quantity,
            placements: [
              {
                placement: placement.placement,
                technique: placement.technique,
                layers: [
                  {
                    type: 'file',
                    url: artworkUrl,
                  },
                ],
              },
            ],
          },
        ],
      },
      requestConfig
    );
  } catch (error) {
    logger.error('[PrintfulService] Printful order creation request failed', error);
    throw new AppError('Printful order creation failed', 502, 'PRINTFUL_CREATE_FAILED');
  }

  const createdOrder = extractOrderData(response);
  if (!createdOrder.id) {
    throw new AppError('Printful did not return an order ID', 502, 'PRINTFUL_BAD_RESPONSE');
  }

  let finalOrder = createdOrder;
  if (env.PRINTFUL_CONFIRM_ORDERS) {
    try {
      const confirmationResponse = await axios.post(
        `https://api.printful.com/v2/orders/${createdOrder.id}/confirmation`,
        {},
        requestConfig
      );
      finalOrder = extractOrderData(confirmationResponse);
    } catch (error) {
      logger.error('[PrintfulService] Printful order confirmation request failed', error);
      throw new AppError('Printful order confirmation failed', 502, 'PRINTFUL_CONFIRM_FAILED');
    }
  }

  return {
    id: String(finalOrder.id ?? createdOrder.id),
    status:
      typeof finalOrder.status === 'string'
        ? finalOrder.status
        : typeof createdOrder.status === 'string'
          ? createdOrder.status
          : undefined,
  };
}
