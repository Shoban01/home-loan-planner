// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/ui/App.tsx';

describe('App smoke', () => {
  it('renders the EMI header and the reveal for the default scenario', () => {
    render(<App />);
    expect(screen.getByText(/what you pay monthly/i)).toBeDefined();
    expect(screen.getByText('₹43,391')).toBeDefined();       // default EMI
    expect(screen.getAllByText(/₹1\.04 Cr/).length).toBeGreaterThan(0); // total repaid
  });
  it('renders both collapsed expander headers', () => {
    render(<App />);
    expect(screen.getByText('What if interest rates change?')).toBeDefined();
    expect(screen.getByText('Can I afford this loan?')).toBeDefined();
  });
});
