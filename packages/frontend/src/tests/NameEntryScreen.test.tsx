import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NameEntryScreen } from '../screens/NameEntryScreen';

const mockSetPlayerInfo = vi.fn();

vi.mock('../ws/WSContext', () => ({
  useConnection: () => ({ setPlayerInfo: mockSetPlayerInfo }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      const map: Record<string, string> = {
        'name_entry.warning': 'EPILEPSY WARNING',
        'name_entry.enter_name': 'ENTER YOUR NAME',
        'name_entry.placeholder_name': 'YOUR NAME',
        'name_entry.lightning_address': 'LIGHTNING ADDRESS',
        'name_entry.confirm': 'CONFIRM',
      };
      return map[key] ?? key;
    },
  }),
}));

describe('NameEntryScreen', () => {
  beforeEach(() => {
    mockSetPlayerInfo.mockClear();
  });

  describe('submit gating', () => {
    it('disables the confirm button when both fields are empty', () => {
      render(<NameEntryScreen />);
      expect(screen.getByText('CONFIRM')).toBeDisabled();
    });

    it('disables confirm when only name is filled', async () => {
      render(<NameEntryScreen />);
      await userEvent.type(screen.getByPlaceholderText('YOUR NAME'), 'Nic');
      expect(screen.getByText('CONFIRM')).toBeDisabled();
    });

    it('disables confirm when only lightning address is filled', async () => {
      render(<NameEntryScreen />);
      await userEvent.type(screen.getByPlaceholderText('you@wallet.com'), 'nic@walletofsatoshi.com');
      expect(screen.getByText('CONFIRM')).toBeDisabled();
    });

    it('enables confirm when both fields are filled', async () => {
      render(<NameEntryScreen />);
      await userEvent.type(screen.getByPlaceholderText('YOUR NAME'), 'Nic');
      await userEvent.type(screen.getByPlaceholderText('you@wallet.com'), 'nic@walletofsatoshi.com');
      expect(screen.getByText('CONFIRM')).toBeEnabled();
    });

    it('trims whitespace — whitespace-only inputs do not enable the button', async () => {
      render(<NameEntryScreen />);
      await userEvent.type(screen.getByPlaceholderText('YOUR NAME'), '   ');
      await userEvent.type(screen.getByPlaceholderText('you@wallet.com'), '   ');
      expect(screen.getByText('CONFIRM')).toBeDisabled();
    });
  });

  describe('submission', () => {
    it('calls setPlayerInfo with trimmed values on button click', async () => {
      render(<NameEntryScreen />);
      await userEvent.type(screen.getByPlaceholderText('YOUR NAME'), '  Nic  ');
      await userEvent.type(screen.getByPlaceholderText('you@wallet.com'), '  nic@wallet.com  ');
      await userEvent.click(screen.getByText('CONFIRM'));
      expect(mockSetPlayerInfo).toHaveBeenCalledWith('Nic', 'nic@wallet.com');
    });

    it('calls setPlayerInfo when Enter is pressed in the name field', async () => {
      render(<NameEntryScreen />);
      await userEvent.type(screen.getByPlaceholderText('YOUR NAME'), 'Nic');
      await userEvent.type(screen.getByPlaceholderText('you@wallet.com'), 'nic@wallet.com');
      await userEvent.keyboard('{Enter}');
      expect(mockSetPlayerInfo).toHaveBeenCalledWith('Nic', 'nic@wallet.com');
    });

    it('does not call setPlayerInfo when fields are incomplete', async () => {
      render(<NameEntryScreen />);
      await userEvent.type(screen.getByPlaceholderText('YOUR NAME'), 'Nic');
      await userEvent.keyboard('{Enter}');
      expect(mockSetPlayerInfo).not.toHaveBeenCalled();
    });
  });

  describe('lightning address tooltip', () => {
    it('tooltip is hidden by default', () => {
      render(<NameEntryScreen />);
      expect(screen.queryByText(/like an email address/i)).not.toBeInTheDocument();
    });

    it('shows tooltip when ? button is clicked', async () => {
      render(<NameEntryScreen />);
      await userEvent.click(screen.getByRole('button', { name: '?' }));
      expect(screen.getByText(/like an email address/i)).toBeInTheDocument();
    });

    it('hides tooltip on second click (toggle)', async () => {
      render(<NameEntryScreen />);
      const btn = screen.getByRole('button', { name: '?' });
      await userEvent.click(btn);
      await userEvent.click(btn);
      expect(screen.queryByText(/like an email address/i)).not.toBeInTheDocument();
    });

    it('links to walletofsatoshi.com', async () => {
      render(<NameEntryScreen />);
      await userEvent.click(screen.getByRole('button', { name: '?' }));
      const link = screen.getByRole('link', { name: /walletofsatoshi/i });
      expect(link).toHaveAttribute('href', 'https://www.walletofsatoshi.com');
      expect(link).toHaveAttribute('target', '_blank');
    });
  });
});
