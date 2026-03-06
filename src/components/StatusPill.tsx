import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../config/theme';
import { prettifyStatus } from '../utils/format';

export function StatusPill({ status }: { status: string }) {
  const colors = pickStatusColors(status);

  return (
    <View style={[styles.pill, { backgroundColor: colors.background }]}>
      <Text style={[styles.text, { color: colors.text }]}>{prettifyStatus(status)}</Text>
    </View>
  );
}

function pickStatusColors(status: string): { background: string; text: string } {
  switch (status) {
    case 'placed':
      return { background: '#dbeafe', text: '#1d4ed8' };
    case 'accepted':
      return { background: '#e0e7ff', text: '#4338ca' };
    case 'preparing':
      return { background: '#fef3c7', text: '#b45309' };
    case 'out_for_delivery':
      return { background: '#ede9fe', text: '#6d28d9' };
    case 'delivered':
      return { background: '#dcfce7', text: '#15803d' };
    case 'cancelled':
      return { background: '#fee2e2', text: '#b91c1c' };
    default:
      return { background: '#e2e8f0', text: '#334155' };
  }
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});
