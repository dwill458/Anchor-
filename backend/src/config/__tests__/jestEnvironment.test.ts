describe('Jest environment bootstrap', () => {
  it('provides a deterministic non-secret database placeholder', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.DATABASE_URL).toBe(
      'postgresql://anchor_test:anchor_test@127.0.0.1:1/anchor_test?connection_limit=1',
    );
    expect(process.env.DATABASE_URL).not.toContain('railway');
    expect(process.env.CHART_PG_DATABASE_URL).toBeUndefined();
  });
});
