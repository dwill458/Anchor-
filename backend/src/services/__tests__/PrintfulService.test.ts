import axios from 'axios';
import { env } from '../../config/env';
import {
  createPrintfulMockupPreview,
  createPrintfulOrder,
  isPrintfulOrderCreationEnabled,
  resolvePrintfulMockupTemplateId,
  resolvePrintfulVariantId,
} from '../PrintfulService';

jest.mock('axios');

jest.mock('../../config/env', () => ({
  env: {
    PRINTFUL_API_KEY: 'pf_test_key',
    PRINTFUL_STORE_ID: '12345',
    PRINTFUL_CREATE_ORDERS: false,
    PRINTFUL_CONFIRM_ORDERS: false,
    PRINTFUL_VARIANT_IDS: '{"print":111,"desk-mat":222}',
    PRINTFUL_MOCKUP_TEMPLATE_IDS: '{"print":9001,"phone-case:iphone-16":9003,"desk-mat":9002}',
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PrintfulService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    env.PRINTFUL_API_KEY = 'pf_test_key';
    env.PRINTFUL_STORE_ID = '12345';
    env.PRINTFUL_CREATE_ORDERS = false;
    env.PRINTFUL_CONFIRM_ORDERS = false;
    env.PRINTFUL_VARIANT_IDS = '{"print":111,"desk-mat":222}';
    env.PRINTFUL_MOCKUP_TEMPLATE_IDS = '{"print":9001,"phone-case:iphone-16":9003,"desk-mat":9002}';
  });

  it('only enables order creation when explicitly set true', () => {
    expect(isPrintfulOrderCreationEnabled()).toBe(false);

    env.PRINTFUL_CREATE_ORDERS = true;

    expect(isPrintfulOrderCreationEnabled()).toBe(true);
  });

  it('resolves exact product, size, and color mappings before fallback mappings', () => {
    expect(resolvePrintfulVariantId('Desk Mat')).toBe(222);
    expect(resolvePrintfulVariantId('Print')).toBe(111);
  });

  it('resolves the configured mockup template ID for a product type', () => {
    expect(resolvePrintfulMockupTemplateId('Desk Mat')).toBe(9002);
    expect(resolvePrintfulMockupTemplateId('Print')).toBe(9001);
    expect(resolvePrintfulMockupTemplateId('Phone Case', 'iPhone 16')).toBe(9003);
  });

  it('creates a draft Printful order with the mapped variant and uploaded artwork URL', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          id: 98765,
          status: 'draft',
        },
      },
    });

    const result = await createPrintfulOrder({
      externalId: 'local-order-1',
      productType: 'Desk Mat',
      size: 'Standard',
      color: 'Black',
      quantity: 1,
      artworkUrl: 'https://cdn.example.com/anchor.png',
      shippingInfo: {
        name: 'Test Buyer',
        email: 'buyer@example.com',
        addressLine1: '100 Main St',
        city: 'Dallas',
        state: 'TX',
        postalCode: '75201',
        country: 'US',
      },
    });

    expect(result).toEqual({ id: '98765', status: 'draft' });
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.printful.com/v2/orders',
      expect.objectContaining({
        external_id: 'local-order-1',
        order_items: [
          {
            source: 'catalog',
            catalog_variant_id: 222,
            quantity: 1,
            placements: [
              {
                placement: 'default',
                technique: 'sublimation',
                layers: [{ type: 'file', url: 'https://cdn.example.com/anchor.png' }],
              },
            ],
          },
        ],
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer pf_test_key',
        }),
        params: { store_id: '12345' },
      })
    );
  });

  it('confirms the order when PRINTFUL_CONFIRM_ORDERS is enabled', async () => {
    env.PRINTFUL_CONFIRM_ORDERS = true;
    mockedAxios.post
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 55555,
            status: 'draft',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 55555,
            status: 'pending',
          },
        },
      });

    const result = await createPrintfulOrder({
      externalId: 'local-order-2',
      productType: 'Print',
      quantity: 1,
      artworkUrl: 'https://cdn.example.com/anchor.png',
      shippingInfo: {
        name: 'Test Buyer',
        addressLine1: '100 Main St',
        city: 'Dallas',
        state: 'TX',
        postalCode: '75201',
        country: 'US',
      },
    });

    expect(result).toEqual({ id: '55555', status: 'pending' });
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      2,
      'https://api.printful.com/v2/orders/55555/confirmation',
      {},
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer pf_test_key',
        }),
        params: { store_id: '12345' },
      })
    );
  });

  it('creates and polls a Printful mockup task before returning the preview URL', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          result: {
            variant_mapping: [
              {
                variant_id: 222,
                templates: [
                  {
                    placement: 'default',
                    template_id: 77,
                  },
                ],
              },
            ],
            templates: [
              {
                template_id: 77,
                print_area_width: 1600,
                print_area_height: 900,
                print_area_top: 120,
                print_area_left: 80,
              },
            ],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          result: {
            status: 'completed',
            mockups: [
              {
                mockup_url: 'https://printful.example.com/mockup.jpg',
              },
            ],
          },
        },
      });
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        result: {
          task_key: 'task_123',
        },
      },
    });

    const result = await createPrintfulMockupPreview({
      productType: 'Desk Mat',
      size: '12x18',
      color: 'Black',
      artworkUrl: 'https://cdn.example.com/anchor.png',
    });

    expect(result).toEqual({ previewUrl: 'https://printful.example.com/mockup.jpg' });
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.printful.com/mockup-generator/create-task/9002',
      {
        variant_ids: [222],
        format: 'jpg',
        files: [
          {
            placement: 'default',
            image_url: 'https://cdn.example.com/anchor.png',
            position: {
              area_width: 1600,
              area_height: 900,
              width: 1600,
              height: 900,
              top: 120,
              left: 80,
            },
          },
        ],
      },
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer pf_test_key',
        }),
      })
    );
    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      1,
      'https://api.printful.com/mockup-generator/templates/9002',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer pf_test_key',
        }),
        params: { store_id: '12345' },
      })
    );
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.printful.com/mockup-generator/task',
      expect.objectContaining({
        params: expect.objectContaining({
          store_id: '12345',
          task_key: 'task_123',
        }),
      })
    );
  });

  it('rejects invalid variant mapping config before calling Printful', async () => {
    env.PRINTFUL_VARIANT_IDS = '{"print":"not-a-number"}';

    await expect(
      createPrintfulOrder({
        externalId: 'local-order-1',
        productType: 'Print',
        quantity: 1,
        artworkUrl: 'https://cdn.example.com/anchor.png',
        shippingInfo: {
          name: 'Test Buyer',
          addressLine1: '100 Main St',
          city: 'Dallas',
          state: 'TX',
          postalCode: '75201',
          country: 'US',
        },
      })
    ).rejects.toMatchObject({ code: 'PRINTFUL_MAPPING_INVALID' });

    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('rejects invalid mockup template mapping config before calling Printful', async () => {
    env.PRINTFUL_MOCKUP_TEMPLATE_IDS = '{"print":"not-a-number"}';

    await expect(
      createPrintfulMockupPreview({
        productType: 'Print',
        artworkUrl: 'https://cdn.example.com/anchor.png',
      })
    ).rejects.toMatchObject({ code: 'PRINTFUL_TEMPLATE_INVALID' });

    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});
