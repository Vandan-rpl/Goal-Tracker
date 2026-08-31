import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

/**
 * ============================================================
 * EmptyState
 * ============================================================
 * Consistent "no data" placeholder for lists/tables app-wide (goal
 * lists, notification lists, team member lists, etc) instead of each
 * page rendering its own empty table or blank space.
 *
 * Usage:
 *   <EmptyState
 *     title="No goals yet"
 *     description="Goals you create will show up here."
 *     icon={<FlagOutlinedIcon />}
 *     action={<Button onClick={...}>Create a goal</Button>}
 *   />
 * ============================================================
 */
export default function EmptyState({
  icon = <InboxOutlinedIcon sx={{ fontSize: 40 }} />,
  title = 'Nothing here yet',
  description = '',
  action = null,
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: 6,
        px: 3,
      }}
    >
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'primary.lighter',
          color: 'primary.main',
          mb: 2,
        }}
      >
        {icon}
      </Box>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: description ? 0.5 : 0 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, mb: action ? 2.5 : 0 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: action && !description ? 2.5 : 0 }}>{action}</Box>}
    </Box>
  );
}
